import uuid
import json
import base64
import os
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request
from pydantic import BaseModel
from emergentintegrations.llm.chat import UserMessage, ImageContent

from services.estimate_analyzer import analyze_estimate_item, deep_normalize, match_service_key, get_classification

router = APIRouter(prefix="/estimates", tags=["estimates"])

# These will be injected from server.py
db = None
_get_current_user_fn = None
LlmChat = None
api_key = None


def init_router(_db, _get_current_user, _LlmChat, _api_key):
    global db, _get_current_user_fn, LlmChat, api_key
    db = _db
    _get_current_user_fn = _get_current_user
    LlmChat = _LlmChat
    api_key = _api_key


async def get_user(request: Request):
    """Wrapper to call the injected get_current_user dependency."""
    from fastapi.security import HTTPBearer
    security = HTTPBearer(auto_error=False)
    credentials = await security(request)
    return await _get_current_user_fn(request, credentials)


class EstimateItemUpdate(BaseModel):
    service_key: Optional[str] = None
    display_name: Optional[str] = None
    category: Optional[str] = None
    recommendation: Optional[str] = None


class ReanalyzeRequest(BaseModel):
    schedule_code: str = "SCHEDULE_1"


class ClaimRequest(BaseModel):
    guest_token: str


class ConvertItemsRequest(BaseModel):
    item_ids: list[str] = []
    vehicle_id: str | None = None
    create_vehicle: bool = False


def _detect_region_from_ocr(ocr_data: dict) -> Optional[str]:
    """Detect region from OCR output by checking for currency, zip codes, etc."""
    raw = (ocr_data.get("raw_text_summary", "") + " " + (ocr_data.get("provider") or "")).lower()
    # Check all line items too
    for li in ocr_data.get("line_items", []):
        raw += " " + (li.get("description", "") + " " + li.get("notes", "")).lower()

    # US signals
    us_states = r'\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b'
    us_zip = r'\b\d{5}(-\d{4})?\b'
    ca_postal = r'\b[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d\b'

    has_usd = 'usd' in raw or '$ usd' in raw
    has_cad = 'cad' in raw or 'c$' in raw or 'cdn' in raw
    has_us_zip = bool(re.search(us_zip, raw))
    has_ca_postal = bool(re.search(ca_postal, raw))
    has_us_state = bool(re.search(us_states, ocr_data.get("raw_text_summary", "") + " " + (ocr_data.get("provider") or "")))

    us_score = int(has_usd) + int(has_us_zip) + int(has_us_state)
    ca_score = int(has_cad) + int(has_ca_postal)

    if us_score > ca_score and us_score > 0:
        return "US"
    if ca_score > us_score and ca_score > 0:
        return "CA"
    return None


# --- Region Profiles ---

@router.get("/region-profiles")
async def get_region_profiles(current_user: dict = Depends(get_user)):
    """Return all active region profiles."""
    profiles = await db.region_profiles.find({"is_active": True}, {"_id": 0}).to_list(20)
    return {"profiles": profiles}


@router.get("/supported-vehicles")
async def get_supported_vehicles(current_user: dict = Depends(get_user)):
    """Return make/model/year combos with available regions."""
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {
            "_id": {"make": "$make", "model": "$model", "year": "$year"},
            "regions": {"$addToSet": "$region"},
        }},
        {"$sort": {"_id.make": 1, "_id.model": 1, "_id.year": 1}},
    ]
    results = await db.maintenance_schedule_rules.aggregate(pipeline).to_list(500)
    supported = [
        {
            "make": r["_id"]["make"],
            "model": r["_id"]["model"],
            "year": r["_id"]["year"],
            "regions": sorted(r["regions"]),
        }
        for r in results
    ]
    return {"supported_vehicles": supported}


# --- Public (Guest) Endpoints - No auth required ---

@router.get("/public/region-profiles")
async def public_region_profiles():
    profiles = await db.region_profiles.find({"is_active": True}, {"_id": 0}).to_list(20)
    return {"profiles": profiles}


@router.get("/public/supported-vehicles")
async def public_supported_vehicles():
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {
            "_id": {"make": "$make", "model": "$model", "year": "$year"},
            "regions": {"$addToSet": "$region"},
        }},
        {"$sort": {"_id.make": 1, "_id.model": 1, "_id.year": 1}},
    ]
    results = await db.maintenance_schedule_rules.aggregate(pipeline).to_list(500)
    return {"supported_vehicles": [
        {"make": r["_id"]["make"], "model": r["_id"]["model"], "year": r["_id"]["year"], "regions": sorted(r["regions"])}
        for r in results
    ]}


@router.post("/public/analyze")
async def guest_analyze_estimate(
    file: UploadFile = File(...),
    make: str = Form(...),
    model: str = Form(...),
    year: int = Form(2020),
    region_code: str = Form("CA"),
    current_mileage: Optional[int] = Form(None),
):
    """Public endpoint: analyze estimate without login."""
    allowed_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Only JPEG, PNG, WebP images and PDF files are supported")

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB)")

    vehicle = {"make": make, "model": model, "year": year}
    ocr_data = await extract_estimate_via_ocr(file_bytes, file.content_type, file.filename)
    detected_region = _detect_region_from_ocr(ocr_data)

    distance_unit = "mi" if region_code == "US" else "km"
    currency_code = "USD" if region_code == "US" else "CAD"
    schedule_code = "SCHEDULE_1"

    estimate_id = str(uuid.uuid4())
    guest_token = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    estimate = {
        "id": estimate_id,
        "user_id": None,
        "guest_token": guest_token,
        "make": make,
        "model": model,
        "year": year,
        "vehicle_info": f"{year} {make} {model}",
        "provider": ocr_data.get("provider"),
        "estimate_date": ocr_data.get("date"),
        "total_quoted": ocr_data.get("total_amount", 0),
        "raw_text_summary": ocr_data.get("raw_text_summary", ""),
        "file_name": file.filename,
        "file_type": file.content_type,
        "status": "analyzed",
        "region_code": region_code,
        "detected_region": detected_region,
        "schedule_code": schedule_code,
        "current_mileage": current_mileage,
        "distance_unit": distance_unit,
        "currency_code": currency_code,
        "created_at": now,
        "updated_at": now,
    }

    items = []
    for idx, li in enumerate(ocr_data.get("line_items", [])):
        analysis = await analyze_estimate_item(
            db, raw_text=li.get("description", ""), quoted_price=float(li.get("price", 0)),
            vehicle=vehicle, region_code=region_code, schedule_code=schedule_code, current_mileage=current_mileage,
        )
        item = {
            "id": str(uuid.uuid4()), "estimate_id": estimate_id, "item_index": idx,
            "raw_text": li.get("description", ""), "quantity": li.get("quantity", 1),
            "notes": li.get("notes", ""), **analysis,
            "user_override": False, "approved": False, "converted_to_service": False,
        }
        items.append(item)

    await db.repair_estimates.insert_one({**estimate, "_id": estimate_id})
    if items:
        await db.repair_estimate_items.insert_many([{**i, "_id": i["id"]} for i in items])
    for item in items:
        item.pop("_id", None)

    return {"estimate": estimate, "items": items, "summary": _build_summary(items), "guest_token": guest_token}


@router.get("/public/results/{estimate_id}")
async def guest_get_results(estimate_id: str, guest_token: str = Query(...)):
    """Public endpoint: retrieve guest estimate results."""
    estimate = await db.repair_estimates.find_one(
        {"id": estimate_id, "guest_token": guest_token}, {"_id": 0}
    )
    if not estimate:
        raise HTTPException(404, "Estimate not found")
    items = await db.repair_estimate_items.find(
        {"estimate_id": estimate_id}, {"_id": 0}
    ).sort("item_index", 1).to_list(100)
    return {"estimate": estimate, "items": items, "summary": _build_summary(items)}


@router.post("/public/results/{estimate_id}/reanalyze")
async def guest_reanalyze(estimate_id: str, guest_token: str = Query(...), body: ReanalyzeRequest = None):
    """Public endpoint: re-run guest estimate with different driving conditions."""
    if body is None:
        body = ReanalyzeRequest()
    estimate = await db.repair_estimates.find_one(
        {"id": estimate_id, "guest_token": guest_token}, {"_id": 0}
    )
    if not estimate:
        raise HTTPException(404, "Estimate not found")

    vehicle = {"make": estimate.get("make", ""), "model": estimate.get("model", ""), "year": estimate.get("year", 0)}
    region_code = estimate.get("region_code") or "CA"
    mileage = estimate.get("current_mileage")

    updated_items = []
    items = await db.repair_estimate_items.find({"estimate_id": estimate_id}, {"_id": 0}).sort("item_index", 1).to_list(100)
    for item in items:
        analysis = await analyze_estimate_item(
            db, raw_text=item["raw_text"], quoted_price=item.get("quoted_price", 0),
            vehicle=vehicle, region_code=region_code, schedule_code=body.schedule_code, current_mileage=mileage,
        )
        update_fields = {
            k: analysis[k] for k in [
                "service_key", "display_name", "description", "matched_synonym",
                "match_type", "match_strategy", "match_confidence", "category",
                "severity", "default_recommendation_code", "recommendation_text",
                "user_explanation", "region_code", "schedule_used", "due_status",
                "interval_value", "interval_unit", "interval_km", "interval_miles",
                "miles_remaining", "trigger_type", "severe_only", "maintenance_match",
                "schedule_notes", "source_reference", "rule_trace", "normalized_text",
            ] if k in analysis
        }
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.repair_estimate_items.update_one({"id": item["id"]}, {"$set": update_fields})
        updated_items.append({**item, **update_fields})

    await db.repair_estimates.update_one(
        {"id": estimate_id}, {"$set": {"schedule_code": body.schedule_code, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"estimate": {**estimate, "schedule_code": body.schedule_code}, "items": updated_items, "summary": _build_summary(updated_items)}


@router.post("/public/claim/{estimate_id}")
async def claim_guest_estimate(estimate_id: str, body: ClaimRequest, current_user: dict = Depends(get_user)):
    """Claim a guest estimate after login."""
    estimate = await db.repair_estimates.find_one(
        {"id": estimate_id, "user_id": None, "guest_token": body.guest_token}
    )
    if not estimate:
        raise HTTPException(404, "Guest estimate not found or already claimed")

    await db.repair_estimates.update_one(
        {"id": estimate_id},
        {"$set": {"user_id": current_user["id"], "guest_token": None}}
    )
    return {"message": "Estimate claimed", "id": estimate_id}


# --- OCR Extraction ---
async def extract_estimate_via_ocr(file_bytes: bytes, content_type: str, filename: str) -> dict:
    """Use GPT-5.2 vision to extract line items from an estimate image/PDF."""
    import fitz

    images_b64 = []
    if content_type == "application/pdf":
        pdf_doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page_num in range(min(len(pdf_doc), 5)):
            page = pdf_doc[page_num]
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img_bytes = pix.tobytes("png")
            images_b64.append(base64.b64encode(img_bytes).decode("utf-8"))
        pdf_doc.close()
    else:
        images_b64.append(base64.b64encode(file_bytes).decode("utf-8"))

    chat = LlmChat(
        api_key=api_key,
        session_id=f"estimate-ocr-{uuid.uuid4()}",
        system_message="""You are an expert at extracting repair estimate and mechanic quote information from documents.

Extract ALL line items from this repair estimate. For each line item extract:
- description: the service/repair description exactly as written
- price: the quoted price as a number (0 if not shown or N/C)
- quantity: quantity if shown (default 1)
- notes: any additional notes, conditions, or observations mentioned

Also extract:
- provider: shop/dealer name
- date: estimate date (YYYY-MM-DD or null)
- total_amount: total quoted amount if shown
- vehicle_info: any vehicle details mentioned (make, model, year, odometer)

Return JSON:
{
  "line_items": [
    {"description": "...", "price": 0.0, "quantity": 1, "notes": "..."}
  ],
  "provider": "...",
  "date": "YYYY-MM-DD or null",
  "total_amount": 0.0,
  "vehicle_info": {"make": "", "model": "", "year": 0, "odometer": 0, "vin": ""},
  "raw_text_summary": "brief summary of the document"
}

Extract ALL items including $0 and informational items. Be thorough.

IMPORTANT: Do NOT include summary lines like "Total", "Subtotal", "Tax", "Grand Total", "Balance Due", or "Amount Due" as line items. Only extract actual service/repair items."""
    ).with_model("openai", "gpt-5.2")

    image_contents = [ImageContent(image_base64=img_b64) for img_b64 in images_b64]
    user_message = UserMessage(
        text="Extract all line items from this repair estimate.",
        file_contents=image_contents
    )
    response = await chat.send_message(user_message)

    # Parse JSON from response
    json_match = re.search(r'\{[\s\S]*\}', response)
    if json_match:
        return json.loads(json_match.group())

    return {"line_items": [], "raw_text_summary": response}


# --- API Endpoints ---

@router.post("")
async def create_estimate(
    file: UploadFile = File(...),
    make: str = Form(...),
    model: str = Form(...),
    year: int = Form(2020),
    region_code: str = Form("CA"),
    schedule_code: str = Form("SCHEDULE_1"),
    current_mileage: Optional[int] = Form(None),
    current_user: dict = Depends(get_user)
):
    # Validate file
    allowed_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Only JPEG, PNG, WebP images and PDF files are supported")

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB)")

    # Check if make/model/year is supported for this region
    supported_count = await db.maintenance_schedule_rules.count_documents({
        "make": make, "model": model, "year": year, "region": region_code, "is_active": True
    })
    if supported_count == 0:
        # Fallback: check any region
        any_count = await db.maintenance_schedule_rules.count_documents({
            "make": make, "model": model, "year": year, "is_active": True
        })
        if any_count == 0:
            raise HTTPException(
                400,
                f"Estimate Checker is not yet supported for {year} {make} {model}."
            )

    vehicle = {"make": make, "model": model, "year": year}

    # Extract via OCR
    ocr_data = await extract_estimate_via_ocr(file_bytes, file.content_type, file.filename)

    # Auto-detect region from OCR data
    detected_region = _detect_region_from_ocr(ocr_data)

    distance_unit = "mi" if region_code == "US" else "km"
    currency_code = "USD" if region_code == "US" else "CAD"

    # Create estimate record
    estimate_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    estimate = {
        "id": estimate_id,
        "user_id": current_user["id"],
        "make": make,
        "model": model,
        "year": year,
        "vehicle_info": f"{year} {make} {model}",
        "provider": ocr_data.get("provider"),
        "estimate_date": ocr_data.get("date"),
        "total_quoted": ocr_data.get("total_amount", 0),
        "raw_text_summary": ocr_data.get("raw_text_summary", ""),
        "file_name": file.filename,
        "file_type": file.content_type,
        "status": "analyzed",
        "region_code": region_code,
        "detected_region": detected_region,
        "schedule_code": schedule_code,
        "current_mileage": current_mileage,
        "distance_unit": distance_unit,
        "currency_code": currency_code,
        "created_at": now,
        "updated_at": now
    }

    # Analyze each line item
    items = []
    for idx, li in enumerate(ocr_data.get("line_items", [])):
        analysis = await analyze_estimate_item(
            db,
            raw_text=li.get("description", ""),
            quoted_price=float(li.get("price", 0)),
            vehicle=vehicle,
            region_code=region_code,
            schedule_code=schedule_code,
            current_mileage=current_mileage,
        )

        item = {
            "id": str(uuid.uuid4()),
            "estimate_id": estimate_id,
            "item_index": idx,
            "raw_text": li.get("description", ""),
            "quantity": li.get("quantity", 1),
            "notes": li.get("notes", ""),
            **analysis,
            "user_override": False,
            "approved": False,
            "converted_to_service": False
        }
        items.append(item)

    # Save to DB
    await db.repair_estimates.insert_one({**estimate, "_id": estimate_id})
    if items:
        await db.repair_estimate_items.insert_many([{**i, "_id": i["id"]} for i in items])

    # Clean _id from response
    for item in items:
        item.pop("_id", None)

    return {
        "estimate": estimate,
        "items": items,
        "summary": _build_summary(items)
    }


@router.get("")
async def list_estimates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_user)
):
    """List user's estimates with pagination."""
    skip = (page - 1) * limit
    total = await db.repair_estimates.count_documents({"user_id": current_user["id"]})
    estimates = await db.repair_estimates.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {"estimates": estimates, "total": total, "page": page, "limit": limit}


@router.get("/{estimate_id}")
async def get_estimate(estimate_id: str, current_user: dict = Depends(get_user)):
    """Get estimate with all analyzed items."""
    estimate = await db.repair_estimates.find_one(
        {"id": estimate_id, "user_id": current_user["id"]}, {"_id": 0}
    )
    if not estimate:
        raise HTTPException(404, "Estimate not found")

    items = await db.repair_estimate_items.find(
        {"estimate_id": estimate_id}, {"_id": 0}
    ).sort("item_index", 1).to_list(100)

    return {
        "estimate": estimate,
        "items": items,
        "summary": _build_summary(items)
    }


@router.delete("/{estimate_id}")
async def delete_estimate(estimate_id: str, current_user: dict = Depends(get_user)):
    """Delete an estimate and its items."""
    estimate = await db.repair_estimates.find_one(
        {"id": estimate_id, "user_id": current_user["id"]}
    )
    if not estimate:
        raise HTTPException(404, "Estimate not found")

    await db.repair_estimate_items.delete_many({"estimate_id": estimate_id})
    await db.repair_estimates.delete_one({"id": estimate_id})
    return {"message": "Estimate deleted"}


@router.patch("/{estimate_id}/items/{item_id}")
async def update_estimate_item(
    estimate_id: str, item_id: str,
    update: EstimateItemUpdate,
    current_user: dict = Depends(get_user)
):
    """Manually correct an item's classification."""
    # Verify ownership
    estimate = await db.repair_estimates.find_one(
        {"id": estimate_id, "user_id": current_user["id"]}
    )
    if not estimate:
        raise HTTPException(404, "Estimate not found")

    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["user_override"] = True
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.repair_estimate_items.update_one(
        {"id": item_id, "estimate_id": estimate_id},
        {"$set": update_data}
    )

    item = await db.repair_estimate_items.find_one({"id": item_id}, {"_id": 0})
    return item



@router.get("/{estimate_id}/vehicle-status")
async def get_vehicle_status(estimate_id: str, current_user: dict = Depends(get_user)):
    """Cross-reference estimate items with user's service history for matching vehicle."""
    estimate = await db.repair_estimates.find_one({"id": estimate_id}, {"_id": 0})
    if not estimate:
        raise HTTPException(404, "Estimate not found")

    # Find user's vehicle matching estimate's make/model/year (case-insensitive)
    vehicle = await db.vehicles.find_one({
        "user_id": current_user["id"],
        "make": {"$regex": f"^{re.escape(estimate.get('make', ''))}$", "$options": "i"},
        "model": {"$regex": f"^{re.escape(estimate.get('model', ''))}$", "$options": "i"},
        "year": estimate.get("year"),
    }, {"_id": 0})

    if not vehicle:
        return {"vehicle_found": False, "items": {}}

    # Get all service records for this vehicle, sorted newest first
    records = await db.service_records.find(
        {"vehicle_id": vehicle["id"]}, {"_id": 0}
    ).sort("date", -1).to_list(1000)

    if not records:
        return {"vehicle_found": True, "vehicle_id": vehicle["id"], "has_history": False, "items": {}}

    # Get estimate items
    est_items = await db.repair_estimate_items.find(
        {"estimate_id": estimate_id}, {"_id": 0}
    ).to_list(100)

    current_mileage = estimate.get("current_mileage")
    # Fallback: use vehicle's current odometer from garage if estimate doesn't have mileage
    if not current_mileage and vehicle.get("current_odometer"):
        current_mileage = vehicle["current_odometer"]
    result = {}

    for item in est_items:
        item_name = (item.get("display_name") or item.get("raw_text") or "").lower().strip()
        service_key = (item.get("service_key") or "").replace("_", " ").lower()

        # Find best matching service record
        best = None
        for rec in records:
            rec_type = (rec.get("service_type") or "").lower().strip()
            if not rec_type:
                continue
            # Match by name containment or service_key
            if (item_name and (item_name in rec_type or rec_type in item_name)) or \
               (service_key and (service_key in rec_type or rec_type in service_key)):
                best = rec
                break  # sorted desc by date, first match = most recent

        if not best:
            continue

        last_date_str = best.get("date")
        last_odometer = best.get("odometer")
        interval_value = item.get("interval_value") or item.get("interval_km") or item.get("interval_miles")
        interval_unit = item.get("interval_unit", "km")

        days_since = None
        months_since = None
        distance_since = None
        time_status = None
        distance_status = None

        # Calculate time since last service (handle multiple date formats)
        if last_date_str:
            last_dt = None
            try:
                last_dt = datetime.fromisoformat(last_date_str.replace("Z", "+00:00"))
            except Exception:
                pass
            if not last_dt:
                for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%b %d, %Y", "%B %d, %Y"):
                    try:
                        last_dt = datetime.strptime(last_date_str, fmt).replace(tzinfo=timezone.utc)
                        break
                    except Exception:
                        continue
            if last_dt:
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                delta = now - last_dt
                days_since = max(delta.days, 0)
                months_since = days_since // 30
                # Time-based status (default 12-month interval)
                if days_since >= 365:
                    time_status = "overdue"
                elif days_since >= 300:
                    time_status = "due_soon"
                else:
                    time_status = "not_due"

        # Calculate distance since last service
        if last_odometer and current_mileage and current_mileage > last_odometer:
            distance_since = current_mileage - last_odometer
            if interval_value:
                if distance_since >= interval_value:
                    distance_status = "overdue"
                elif distance_since >= interval_value * 0.8:
                    distance_status = "due_soon"
                else:
                    distance_status = "not_due"

        # Final status: worst of time and distance (overdue > due_soon > not_due)
        priority = {"overdue": 3, "due_soon": 2, "not_due": 1}
        candidates = [s for s in [time_status, distance_status] if s]
        if candidates:
            status = max(candidates, key=lambda s: priority.get(s, 0))
        else:
            status = "unknown"

        result[item["id"]] = {
            "last_service_date": last_date_str,
            "last_service_odometer": last_odometer,
            "last_service_type": best.get("service_type"),
            "days_since": days_since,
            "months_since": months_since,
            "distance_since": distance_since,
            "status": status,
            "interval_value": interval_value,
            "interval_unit": interval_unit,
        }

    return {"vehicle_found": True, "vehicle_id": vehicle["id"], "has_history": True, "items": result}



@router.post("/{estimate_id}/reanalyze")
async def reanalyze_estimate(
    estimate_id: str,
    body: ReanalyzeRequest,
    current_user: dict = Depends(get_user),
):
    """Re-run analysis with different driving conditions (schedule)."""
    estimate = await db.repair_estimates.find_one(
        {"id": estimate_id, "user_id": current_user["id"]}, {"_id": 0}
    )
    if not estimate:
        raise HTTPException(404, "Estimate not found")

    items = await db.repair_estimate_items.find(
        {"estimate_id": estimate_id}, {"_id": 0}
    ).sort("item_index", 1).to_list(100)

    vehicle = {"make": estimate.get("make", ""), "model": estimate.get("model", ""), "year": estimate.get("year", 0)}
    region_code = estimate.get("region_code") or "CA"
    mileage = estimate.get("current_mileage")

    # Parse vehicle_info as fallback for older estimates
    if not vehicle["make"] and estimate.get("vehicle_info"):
        parts = estimate["vehicle_info"].split()
        if len(parts) >= 3:
            vehicle = {"make": parts[1], "model": parts[2], "year": int(parts[0]) if parts[0].isdigit() else 0}

    updated_items = []
    for item in items:
        analysis = await analyze_estimate_item(
            db,
            raw_text=item["raw_text"],
            quoted_price=item.get("quoted_price", 0),
            vehicle=vehicle,
            region_code=region_code,
            schedule_code=body.schedule_code,
            current_mileage=mileage,
        )
        update_fields = {
            k: analysis[k] for k in [
                "service_key", "display_name", "description", "matched_synonym",
                "match_type", "match_strategy", "match_confidence", "category",
                "severity", "default_recommendation_code", "recommendation_text",
                "user_explanation", "region_code", "schedule_used", "due_status",
                "interval_value", "interval_unit", "interval_km", "interval_miles",
                "miles_remaining", "trigger_type", "severe_only", "maintenance_match",
                "schedule_notes", "source_reference", "rule_trace", "normalized_text",
            ] if k in analysis
        }
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

        await db.repair_estimate_items.update_one(
            {"id": item["id"]}, {"$set": update_fields}
        )
        updated_items.append({**item, **update_fields})

    # Update schedule on the estimate itself
    await db.repair_estimates.update_one(
        {"id": estimate_id},
        {"$set": {"schedule_code": body.schedule_code, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {
        "estimate": {**estimate, "schedule_code": body.schedule_code},
        "items": updated_items,
        "summary": _build_summary(updated_items),
    }


@router.post("/{estimate_id}/convert")
async def convert_to_service_records(
    estimate_id: str,
    body: ConvertItemsRequest,
    current_user: dict = Depends(get_user)
):
    """Convert approved estimate items into service records."""
    estimate = await db.repair_estimates.find_one(
        {"id": estimate_id, "user_id": current_user["id"]}, {"_id": 0}
    )
    if not estimate:
        raise HTTPException(404, "Estimate not found")

    items = await db.repair_estimate_items.find(
        {"estimate_id": estimate_id, "id": {"$in": body.item_ids}}, {"_id": 0}
    ).to_list(100)

    if not items:
        raise HTTPException(400, "No items selected for conversion")

    # Resolve vehicle_id
    vehicle_id = body.vehicle_id
    if not vehicle_id and body.create_vehicle:
        # Auto-create vehicle from estimate's make/model/year
        new_vehicle = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "make": estimate.get("make", ""),
            "model": estimate.get("model", ""),
            "year": estimate.get("year", 0),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.vehicles.insert_one({**new_vehicle, "_id": new_vehicle["id"]})
        vehicle_id = new_vehicle["id"]
    elif not vehicle_id:
        raise HTTPException(400, "Please select a vehicle or create one to save service records.")

    created = []
    for item in items:
        record = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "vehicle_id": vehicle_id,
            "service_type": item.get("display_name") or item.get("raw_text"),
            "date": estimate.get("estimate_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "price": item.get("quoted_price", 0),
            "location": estimate.get("provider", ""),
            "odometer": estimate.get("current_mileage") or 0,
            "notes": f"Converted from estimate. {item.get('notes', '')}".strip(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.service_records.insert_one({**record, "_id": record["id"]})
        record.pop("_id", None)
        created.append(record)

        # Mark item as converted
        await db.repair_estimate_items.update_one(
            {"id": item["id"]},
            {"$set": {"converted_to_service": True, "approved": True}}
        )

    return {"converted": len(created), "records": created}


def _build_summary(items: list) -> dict:
    """Build a summary of the estimate analysis."""
    total_quoted = sum(i.get("quoted_price", 0) for i in items)
    categories = {}
    for item in items:
        cat = item.get("category", "unknown")
        categories[cat] = categories.get(cat, 0) + 1

    return {
        "total_items": len(items),
        "total_quoted_amount": round(total_quoted, 2),
        "required_count": categories.get("required", 0),
        "conditional_count": categories.get("conditional", 0),
        "not_required_count": categories.get("not_required", 0),
        "informational_count": categories.get("informational", 0),
        "unknown_count": categories.get("unknown", 0),
        "required_total": round(sum(i.get("quoted_price", 0) for i in items if i.get("category") == "required"), 2),
        "conditional_total": round(sum(i.get("quoted_price", 0) for i in items if i.get("category") == "conditional"), 2),
        "not_required_total": round(sum(i.get("quoted_price", 0) for i in items if i.get("category") == "not_required"), 2)
    }


# --- Debug Endpoint ---

class DebugMatchRequest(BaseModel):
    input_line_text: str
    vehicle_make: str = "Mazda"
    vehicle_model: str = "CX-5"
    vehicle_year: int = 2022
    region_code: str = "CA"
    schedule_code: str = "SCHEDULE_1"
    current_mileage: Optional[int] = None


@router.post("/debug/match")
async def debug_match_line(body: DebugMatchRequest, current_user: dict = Depends(get_user)):
    """Debug endpoint: paste a dealer line item and see the full pipeline with rule trace."""
    raw = body.input_line_text
    normalized = deep_normalize(raw)
    match = await match_service_key(db, raw)
    classification = await get_classification(db, match["service_key"])

    vehicle = {"make": body.vehicle_make, "model": body.vehicle_model, "year": body.vehicle_year}
    full_analysis = await analyze_estimate_item(
        db, raw, 0.0, vehicle,
        region_code=body.region_code,
        schedule_code=body.schedule_code,
        current_mileage=body.current_mileage,
    )

    return {
        "input_line_text": raw,
        "normalized_text": normalized,
        "region_code": body.region_code,
        "schedule_code": body.schedule_code,
        "current_mileage": body.current_mileage,
        "distance_unit": "mi" if body.region_code == "US" else "km",
        "inferred_logic": {
            "default_schedule_applied": body.schedule_code,
            "user_selected_schedule": body.schedule_code if body.schedule_code != "SCHEDULE_1" else None,
            "logic": "region_based",
        },
        "match": {
            "service_key": match["service_key"],
            "matched_synonym": match["matched_synonym"],
            "match_strategy": match["match_strategy"],
            "confidence": match["confidence"],
        },
        "classification": {
            "display_name": classification.get("display_name"),
            "category": classification["category"],
            "severity": classification["severity"],
            "default_recommendation_code": classification["default_recommendation_code"],
            "recommendation_text": classification.get("recommendation_text"),
            "user_explanation": classification.get("user_explanation"),
            "description": classification.get("description"),
        },
        "verdict": {
            "due_status": full_analysis.get("due_status"),
            "schedule_used": full_analysis.get("schedule_used"),
            "interval_value": full_analysis.get("interval_value"),
            "interval_unit": full_analysis.get("interval_unit"),
            "miles_remaining": full_analysis.get("miles_remaining"),
            "trigger_type": full_analysis.get("trigger_type"),
            "severe_only": full_analysis.get("severe_only"),
            "source_reference": full_analysis.get("source_reference"),
            "schedule_notes": full_analysis.get("schedule_notes"),
        },
        "rule_trace": full_analysis.get("rule_trace"),
        "full_analysis": full_analysis,
    }
