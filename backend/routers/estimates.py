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
- vehicle_info: any vehicle details mentioned (make, model, year, VIN, odometer)

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
    vehicle_id: str = Form(...),
    current_user: dict = Depends(get_user)
):
    # Validate file
    allowed_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Only JPEG, PNG, WebP images and PDF files are supported")

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB)")

    # Get vehicle
    vehicle = await db.vehicles.find_one(
        {"id": vehicle_id, "user_id": current_user["id"]}, {"_id": 0}
    )
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")

    # Extract via OCR
    ocr_data = await extract_estimate_via_ocr(file_bytes, file.content_type, file.filename)

    # Create estimate record
    estimate_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    estimate = {
        "id": estimate_id,
        "user_id": current_user["id"],
        "vehicle_id": vehicle_id,
        "vehicle_info": f"{vehicle['year']} {vehicle['make']} {vehicle['model']}",
        "provider": ocr_data.get("provider"),
        "estimate_date": ocr_data.get("date"),
        "total_quoted": ocr_data.get("total_amount", 0),
        "raw_text_summary": ocr_data.get("raw_text_summary", ""),
        "file_name": file.filename,
        "file_type": file.content_type,
        "status": "analyzed",
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
            vehicle=vehicle
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


class ConvertItemsRequest(BaseModel):
    item_ids: list[str] = []


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

    created = []
    for item in items:
        record = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "vehicle_id": estimate["vehicle_id"],
            "service_type": item.get("display_name") or item.get("raw_text"),
            "date": estimate.get("estimate_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "price": item.get("quoted_price", 0),
            "location": estimate.get("provider", ""),
            "odometer": 0,  # Default to 0 for converted estimates
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


class DebugMatchRequest(BaseModel):
    input_line_text: str
    vehicle_make: str = "Toyota"
    vehicle_model: str = "Camry"
    vehicle_year: int = 2020


@router.post("/debug/match")
async def debug_match_line(body: DebugMatchRequest, current_user: dict = Depends(get_user)):
    """Debug endpoint: paste a dealer line item and see exactly how the matcher processes it."""
    raw = body.input_line_text
    normalized = deep_normalize(raw)
    match = await match_service_key(db, raw)
    classification = await get_classification(db, match["service_key"])

    vehicle = {"make": body.vehicle_make, "model": body.vehicle_model, "year": body.vehicle_year}
    full_analysis = await analyze_estimate_item(db, raw, 0.0, vehicle)

    return {
        "input_line_text": raw,
        "normalized_text": normalized,
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
        "full_analysis": full_analysis,
    }
