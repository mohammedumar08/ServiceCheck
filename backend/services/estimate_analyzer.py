import re


def normalize_text(text: str) -> str:
    """Normalize input text for synonym matching."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s/\-]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


async def match_service_key(db, raw_text: str):
    """Match raw line item text to a canonical service_key using synonym table."""
    normalized = normalize_text(raw_text)

    # 1. Try exact match first
    exact = await db.service_synonyms.find(
        {"match_type": "exact", "is_active": True}
    ).to_list(500)

    for syn in sorted(exact, key=lambda s: -s.get("priority", 0)):
        if normalized == syn["normalized_synonym_text"]:
            return {
                "service_key": syn["service_key"],
                "matched_synonym": syn["synonym_text"],
                "match_type": "exact",
                "confidence": min(syn.get("priority", 80) / 100, 1.0)
            }

    # 2. Try contains match ordered by priority
    contains = await db.service_synonyms.find(
        {"match_type": "contains", "is_active": True}
    ).to_list(500)

    for syn in sorted(contains, key=lambda s: -s.get("priority", 0)):
        if syn["normalized_synonym_text"] in normalized:
            return {
                "service_key": syn["service_key"],
                "matched_synonym": syn["synonym_text"],
                "match_type": "contains",
                "confidence": min(syn.get("priority", 60) / 100, 0.95)
            }

    # 3. No match
    return {
        "service_key": None,
        "matched_synonym": None,
        "match_type": "none",
        "confidence": 0.0
    }


async def get_classification(db, service_key: str):
    """Lookup classification rules for a service_key."""
    if not service_key:
        return {
            "category": "unknown",
            "display_name": None,
            "description": None,
            "default_recommendation": "cannot_determine",
            "severity": "low",
            "notes_for_user": "Service could not be identified. Review manually."
        }

    rule = await db.service_classification_rules.find_one(
        {"service_key": service_key, "is_active": True}, {"_id": 0}
    )
    if not rule:
        return {
            "category": "unknown",
            "display_name": service_key.replace("_", " ").title(),
            "description": None,
            "default_recommendation": "cannot_determine",
            "severity": "low",
            "notes_for_user": "No classification rule found for this service."
        }

    return {
        "category": rule["category"],
        "display_name": rule["display_name"],
        "description": rule["description"],
        "default_recommendation": rule["default_recommendation"],
        "severity": rule["severity"],
        "notes_for_user": rule["notes_for_user"]
    }


async def get_maintenance_schedule(db, service_key: str, make: str, model: str, year: int, engine: str = None, region: str = "Canada"):
    """Lookup maintenance schedule rules. Prefer exact engine match, fallback to engine=null."""
    if not service_key or not make:
        return {"maintenance_match": "unknown", "schedule_notes": None}

    query = {
        "make": make, "model": model, "year": year,
        "service_key": service_key, "is_active": True
    }

    # Try exact engine match first
    if engine:
        exact_q = {**query, "engine": engine, "region": region}
        rule = await db.maintenance_schedule_rules.find_one(exact_q, {"_id": 0})
        if rule:
            return _format_schedule(rule)

    # Fallback to null/empty engine
    for eng_val in [None, ""]:
        fallback_q = {**query, "engine": eng_val, "region": region}
        rule = await db.maintenance_schedule_rules.find_one(fallback_q, {"_id": 0})
        if rule:
            return _format_schedule(rule, assumed_engine=True if engine else False)

    # Try without region constraint
    for eng_val in [None, ""]:
        fallback_q = {**query, "engine": eng_val}
        rule = await db.maintenance_schedule_rules.find_one(fallback_q, {"_id": 0})
        if rule:
            return _format_schedule(rule, assumed_engine=True if engine else False)

    return {"maintenance_match": "unknown", "schedule_notes": None, "interval_km": None}


def _format_schedule(rule, assumed_engine=False):
    notes = rule.get("notes", "")
    if assumed_engine:
        notes += " (Engine type not specified; using general schedule.)"

    return {
        "maintenance_match": "due",
        "interval_km": rule.get("interval_km") or rule.get("repeat_interval_km"),
        "interval_months": rule.get("interval_months"),
        "first_interval_km": rule.get("first_interval_km"),
        "repeat_interval_km": rule.get("repeat_interval_km"),
        "rule_type": rule.get("rule_type"),
        "schedule_notes": notes,
        "source": rule.get("source_name")
    }


async def analyze_estimate_item(db, raw_text: str, quoted_price: float, vehicle: dict):
    """Full analysis pipeline for a single estimate line item."""
    # Step 1: Match service key
    match = await match_service_key(db, raw_text)
    service_key = match["service_key"]

    # Step 2: Get classification
    classification = await get_classification(db, service_key)

    # Step 3: Get maintenance schedule
    schedule = await get_maintenance_schedule(
        db, service_key,
        make=vehicle.get("make", ""),
        model=vehicle.get("model", ""),
        year=vehicle.get("year", 0),
        engine=vehicle.get("engine"),
        region="Canada"
    )

    # Step 4: Build recommendation
    recommendation = classification["default_recommendation"]
    explanation = classification.get("notes_for_user", "")

    if schedule.get("schedule_notes"):
        explanation += f" Schedule: {schedule['schedule_notes']}"

    return {
        "raw_text": raw_text,
        "service_key": service_key,
        "display_name": classification.get("display_name") or raw_text,
        "matched_synonym": match["matched_synonym"],
        "match_type": match["match_type"],
        "match_confidence": match["confidence"],
        "category": classification["category"],
        "severity": classification.get("severity", "low"),
        "recommendation": recommendation,
        "explanation": explanation,
        "quoted_price": quoted_price,
        "benchmark_min_price": None,
        "benchmark_max_price": None,
        "price_assessment": "unknown",
        "maintenance_match": schedule.get("maintenance_match", "unknown"),
        "interval_km": schedule.get("interval_km"),
        "schedule_notes": schedule.get("schedule_notes")
    }
