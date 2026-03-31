import re


# --- Normalization ---

# Leading dealer/op codes: 1-3 uppercase letters followed by 1-3 digits
_DEALER_CODE_RE = re.compile(r'^[A-Z]{1,4}\d{1,4}\b\s*', re.IGNORECASE)

# Recommendation noise phrases (order matters – longer first)
_NOISE_PHRASES = [
    r'rec(?:ommended)?\s*every\s*\d*\s*(?:mth|month|months|mo|k|km|miles|mi)?\s*/?\s*\d*\s*(?:mth|month|months|mo|k|km|miles|mi)?',
    r'every\s*\d+\s*(?:mth|month|months|mo|k|km|miles|mi)\s*/?\s*\d*\s*(?:mth|month|months|mo|k|km|miles|mi)?',
    r'rec(?:ommended)?\s+',
    r'\d+\s*(?:mth|month|months)\s*/?\s*\d+\s*k\b',
    r'\d+\s*k\b',
]
_NOISE_RE = re.compile('|'.join(f'(?:{p})' for p in _NOISE_PHRASES), re.IGNORECASE)

# Plural -> singular mappings applied as token transforms
_PLURAL_MAP = {
    'injectors': 'injector',
    'filters': 'filter',
    'plugs': 'plug',
    'pads': 'pad',
    'rotors': 'rotor',
    'belts': 'belt',
    'blades': 'blade',
    'coils': 'coil',
    'sensors': 'sensor',
    'bearings': 'bearing',
    'hoses': 'hose',
    'brakes': 'brake',
    'wipers': 'wiper',
    'tires': 'tire',
    'tyres': 'tire',
    'shocks': 'shock',
    'struts': 'strut',
}

# Verb form normalization
_VERB_MAP = {
    'clean': 'cleaning',
    'flush': 'flushing',
    'inspect': 'inspection',
    'replace': 'replacement',
    'align': 'alignment',
    'rotate': 'rotation',
    'balance': 'balancing',
    'recharge': 'recharge',
    'repair': 'repair',
}


def normalize_text(text: str) -> str:
    """Basic normalize: lowercase, strip punctuation, collapse spaces."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s/\-]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def deep_normalize(text: str) -> str:
    """Advanced normalization for dealer estimate line items.
    
    Strips op codes, recommendation noise, normalizes plurals and verb forms.
    """
    cleaned = text.strip()

    # 1. Remove leading dealer/op code (e.g. FU03, BG01, ABC123)
    cleaned = _DEALER_CODE_RE.sub('', cleaned)

    # 2. Lowercase
    cleaned = cleaned.lower()

    # 3. Replace hyphens/slashes surrounded by spaces with spaces
    cleaned = re.sub(r'\s*[-/]\s*', ' ', cleaned)

    # 4. Remove non-alphanumeric except spaces
    cleaned = re.sub(r'[^\w\s]', ' ', cleaned)

    # 5. Remove recommendation noise phrases
    cleaned = _NOISE_RE.sub(' ', cleaned)

    # 6. Collapse whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # 7. Token-level transforms: plural->singular, verb normalization
    tokens = cleaned.split()
    transformed = []
    for t in tokens:
        t = _PLURAL_MAP.get(t, t)
        t = _VERB_MAP.get(t, t)
        transformed.append(t)
    cleaned = ' '.join(transformed)

    return cleaned


# --- Matching ---

async def match_service_key(db, raw_text: str):
    """Match raw line item text to a canonical service_key using synonym table.
    
    Pipeline: exact -> contains -> token-overlap fuzzy.
    """
    basic_norm = normalize_text(raw_text)
    deep_norm = deep_normalize(raw_text)

    # 1. Exact match on deep-normalized text
    exact = await db.service_synonyms.find(
        {"match_type": "exact", "is_active": True}
    ).to_list(500)

    for syn in sorted(exact, key=lambda s: -s.get("priority", 0)):
        syn_norm = syn["normalized_synonym_text"]
        if deep_norm == syn_norm or basic_norm == syn_norm:
            return _match_result(syn, "exact", deep_norm)

    # 2. Contains match on deep-normalized text
    contains = await db.service_synonyms.find(
        {"match_type": "contains", "is_active": True}
    ).to_list(500)

    for syn in sorted(contains, key=lambda s: -s.get("priority", 0)):
        syn_norm = syn["normalized_synonym_text"]
        if syn_norm in deep_norm or syn_norm in basic_norm:
            return _match_result(syn, "contains", deep_norm)

    # 3. Token-overlap fuzzy matching
    # Deep-normalize each synonym's text too and compare tokens
    deep_tokens = set(deep_norm.split())
    if len(deep_tokens) >= 2:
        all_syns = exact + contains
        best_score = 0.0
        best_syn = None
        for syn in all_syns:
            syn_text = syn["normalized_synonym_text"]
            # Also deep-normalize the synonym text for fair comparison
            syn_deep = deep_normalize(syn_text)
            syn_tokens = set(syn_deep.split())
            if not syn_tokens:
                continue
            overlap = deep_tokens & syn_tokens
            # Jaccard-like but weighted toward synonym coverage
            coverage = len(overlap) / len(syn_tokens) if syn_tokens else 0
            if coverage >= 0.6 and len(overlap) >= 2:
                score = coverage * (syn.get("priority", 50) / 100)
                if score > best_score:
                    best_score = score
                    best_syn = syn

        if best_syn:
            return _match_result(best_syn, "token_overlap", deep_norm, confidence_override=min(best_score, 0.85))

    # 4. No match
    return {
        "service_key": None,
        "matched_synonym": None,
        "match_type": "none",
        "match_strategy": "none",
        "normalized_text": deep_norm,
        "confidence": 0.0
    }


def _match_result(syn, strategy, normalized_text, confidence_override=None):
    if confidence_override is not None:
        conf = confidence_override
    elif strategy == "exact":
        conf = min(syn.get("priority", 80) / 100, 1.0)
    else:
        conf = min(syn.get("priority", 60) / 100, 0.95)

    return {
        "service_key": syn["service_key"],
        "matched_synonym": syn["synonym_text"],
        "match_type": strategy,
        "match_strategy": strategy,
        "normalized_text": normalized_text,
        "confidence": conf
    }


# --- Classification & Schedule (unchanged) ---

async def get_classification(db, service_key: str):
    """Lookup classification rules for a service_key."""
    if not service_key:
        return {
            "category": "unknown",
            "display_name": None,
            "description": None,
            "default_recommendation_code": "cannot_determine",
            "recommendation_text": "Service could not be identified.",
            "user_explanation": "Review manually or improve synonym mapping.",
            "severity": "low",
        }

    rule = await db.service_classification_rules.find_one(
        {"service_key": service_key, "is_active": True}, {"_id": 0}
    )
    if not rule:
        return {
            "category": "unknown",
            "display_name": service_key.replace("_", " ").title(),
            "description": None,
            "default_recommendation_code": "cannot_determine",
            "recommendation_text": "Service could not be identified.",
            "user_explanation": "Review manually or improve synonym mapping.",
            "severity": "low",
        }

    return {
        "category": rule["category"],
        "display_name": rule["display_name"],
        "description": rule.get("description"),
        "default_recommendation_code": rule.get("default_recommendation_code", rule.get("default_recommendation", "cannot_determine")),
        "recommendation_text": rule.get("recommendation_text", ""),
        "user_explanation": rule.get("user_explanation", ""),
        "severity": rule["severity"],
    }


async def get_maintenance_schedule(db, service_key: str, make: str, model: str, year: int, engine: str = None, region: str = "Canada"):
    """Lookup maintenance schedule rules."""
    if not service_key or not make:
        return {"maintenance_match": "unknown", "schedule_notes": None}

    query = {
        "make": make, "model": model, "year": year,
        "service_key": service_key, "is_active": True
    }

    if engine:
        exact_q = {**query, "engine": engine, "region": region}
        rule = await db.maintenance_schedule_rules.find_one(exact_q, {"_id": 0})
        if rule:
            return _format_schedule(rule)

    for eng_val in [None, ""]:
        fallback_q = {**query, "engine": eng_val, "region": region}
        rule = await db.maintenance_schedule_rules.find_one(fallback_q, {"_id": 0})
        if rule:
            return _format_schedule(rule, assumed_engine=True if engine else False)

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


# --- Full Analysis Pipeline ---

async def analyze_estimate_item(db, raw_text: str, quoted_price: float, vehicle: dict):
    """Full analysis pipeline for a single estimate line item."""
    match = await match_service_key(db, raw_text)
    service_key = match["service_key"]

    classification = await get_classification(db, service_key)

    schedule = await get_maintenance_schedule(
        db, service_key,
        make=vehicle.get("make", ""),
        model=vehicle.get("model", ""),
        year=vehicle.get("year", 0),
        engine=vehicle.get("engine"),
        region="Canada"
    )

    recommendation_code = classification["default_recommendation_code"]
    recommendation_text = classification.get("recommendation_text", "")
    user_explanation = classification.get("user_explanation", "")

    if schedule.get("schedule_notes"):
        user_explanation += f" Schedule: {schedule['schedule_notes']}"

    return {
        "raw_text": raw_text,
        "normalized_text": match.get("normalized_text", ""),
        "service_key": service_key,
        "display_name": classification.get("display_name") or raw_text,
        "description": classification.get("description"),
        "matched_synonym": match["matched_synonym"],
        "match_type": match["match_type"],
        "match_strategy": match.get("match_strategy", match["match_type"]),
        "match_confidence": match["confidence"],
        "category": classification["category"],
        "severity": classification.get("severity", "low"),
        "default_recommendation_code": recommendation_code,
        "recommendation_text": recommendation_text,
        "user_explanation": user_explanation,
        "quoted_price": quoted_price,
        "benchmark_min_price": None,
        "benchmark_max_price": None,
        "price_assessment": "unknown",
        "maintenance_match": schedule.get("maintenance_match", "unknown"),
        "interval_km": schedule.get("interval_km"),
        "schedule_notes": schedule.get("schedule_notes")
    }
