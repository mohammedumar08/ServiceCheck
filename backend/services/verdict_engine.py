"""Verdict engine: computes due_status from stored maintenance rules."""


def _render_template(template: str, rule: dict) -> str:
    """Fill explanation_template with rule values."""
    if not template:
        return rule.get("notes", "")
    try:
        return template.format(**{k: v for k, v in rule.items() if v is not None})
    except (KeyError, IndexError):
        return template


async def compute_verdict(
    db,
    service_key: str,
    region_code: str,
    make: str,
    model: str,
    year: int,
    schedule_code: str = "SCHEDULE_1",
    current_mileage: int = None,
    engine: str = None,
):
    """Compute due_status for a service based on stored maintenance rules.

    Returns a dict with:
      - due_status, schedule_used, explanation, interval_value, interval_unit,
        miles_remaining, source_reference, rule_trace
    """
    if not service_key or not make:
        return _empty_verdict(region_code, schedule_code, "No service key or vehicle")

    query = {
        "make": make,
        "model": model,
        "year": year,
        "region": region_code,
        "service_key": service_key,
        "is_active": True,
    }
    if region_code == "US" and schedule_code:
        query["schedule_code"] = schedule_code

    rules = await db.maintenance_schedule_rules.find(query, {"_id": 0}).to_list(20)
    if not rules:
        return _empty_verdict(region_code, schedule_code, "No maintenance rule found")

    matched_rule = _pick_rule(rules, engine)

    interval_type = matched_rule.get("interval_type") or matched_rule.get("rule_type") or "unknown"
    is_us = region_code == "US"
    unit = "mi" if is_us else "km"

    result = {
        "region_code": region_code,
        "schedule_used": matched_rule.get("schedule_code"),
        "service_key": service_key,
        "matched_rule_id": matched_rule.get("rule_id"),
        "interval_type": interval_type,
        "severe_only": matched_rule.get("severe_only", False),
        "source_reference": matched_rule.get("source_name"),
        "interval_unit": unit,
    }

    if interval_type == "flexible":
        result.update(_verdict_flexible(matched_rule, is_us, current_mileage))
    elif interval_type in ("recurring", "replace", "rotate", "inspect"):
        result.update(_verdict_recurring(matched_rule, is_us, current_mileage))
    elif interval_type == "first_then_recurring":
        result.update(_verdict_first_then_recurring(matched_rule, is_us, current_mileage))
    elif interval_type == "milestone_replace":
        result.update(_verdict_milestone(matched_rule, current_mileage))
    elif interval_type == "inspection":
        result["due_status"] = "inspection"
        result["explanation"] = matched_rule.get("notes", "Inspect periodically.")
    else:
        result["due_status"] = "unknown"
        result["explanation"] = matched_rule.get("notes", "")

    result["rule_trace"] = {
        "rules_found": len(rules),
        "rule_selected": matched_rule.get("rule_id"),
        "engine_filter": engine,
        "engine_matched": matched_rule.get("engine"),
        "schedule_code": schedule_code,
        "mileage_provided": current_mileage is not None,
    }
    return result


def _empty_verdict(region_code, schedule_code, reason):
    return {
        "region_code": region_code,
        "schedule_used": schedule_code,
        "due_status": "unknown",
        "explanation": "",
        "interval_value": None,
        "interval_unit": "mi" if region_code == "US" else "km",
        "rule_trace": {"rules_found": 0, "reason": reason},
    }


def _pick_rule(rules, engine):
    """Select the best rule, preferring engine-specific matches."""
    if engine:
        for r in rules:
            re = r.get("engine")
            if re and re == engine:
                return r
        for r in rules:
            re = r.get("engine")
            if re == "non-turbo" and engine != "2.5T":
                return r
    # Prefer non-engine-specific, or flexible over fixed
    generic = [r for r in rules if not r.get("engine")]
    if generic:
        flex = [r for r in generic if r.get("interval_type") == "flexible" or r.get("maintenance_mode") == "flexible"]
        if flex:
            return flex[0]
        return generic[0]
    return rules[0]


def _verdict_flexible(rule, is_us, mileage):
    max_val = rule.get("max_miles") if is_us else rule.get("interval_km")
    return {
        "due_status": "condition_based",
        "trigger_type": rule.get("trigger_type", "wrench_indicator_on"),
        "interval_value": max_val,
        "max_interval": max_val,
        "max_months": rule.get("max_months"),
        "explanation": _render_template(rule.get("explanation_template", ""), rule),
    }


def _verdict_recurring(rule, is_us, mileage):
    interval = rule.get("interval_miles") if is_us else (rule.get("interval_km") or rule.get("repeat_interval_km"))
    out = {
        "interval_value": interval,
        "interval_months": rule.get("interval_months"),
        "explanation": _render_template(rule.get("explanation_template", ""), rule),
    }
    if mileage is not None and interval and interval > 0:
        remaining = interval - (mileage % interval)
        out["miles_remaining"] = remaining
        if remaining <= 0:
            out["due_status"] = "due_now"
        elif remaining <= interval * 0.15:
            out["due_status"] = "due_soon"
        else:
            out["due_status"] = "not_due"
    else:
        out["due_status"] = "schedule_known"
    return out


def _verdict_first_then_recurring(rule, is_us, mileage):
    first = rule.get("first_interval_miles") if is_us else rule.get("first_interval_km")
    repeat = rule.get("repeat_interval_miles") if is_us else rule.get("repeat_interval_km")
    out = {
        "interval_value": repeat or first,
        "first_interval": first,
        "repeat_interval": repeat,
        "explanation": _render_template(rule.get("explanation_template", ""), rule),
    }
    if mileage is not None and first:
        if mileage < first:
            remaining = first - mileage
            out["miles_remaining"] = remaining
            out["due_status"] = "due_soon" if remaining <= first * 0.1 else "not_due"
        elif repeat and repeat > 0:
            past_first = mileage - first
            remaining = repeat - (past_first % repeat)
            out["miles_remaining"] = remaining
            if remaining <= 0:
                out["due_status"] = "due_now"
            elif remaining <= repeat * 0.1:
                out["due_status"] = "due_soon"
            else:
                out["due_status"] = "not_due"
        else:
            out["due_status"] = "schedule_known"
    else:
        out["due_status"] = "schedule_known"
    return out


def _verdict_milestone(rule, mileage):
    milestones = rule.get("replace_miles") or []
    out = {
        "milestones": milestones,
        "explanation": _render_template(rule.get("explanation_template", ""), rule),
    }
    if mileage is not None and milestones:
        upcoming = [m for m in milestones if m > mileage]
        if upcoming:
            nxt = min(upcoming)
            remaining = nxt - mileage
            out["interval_value"] = nxt
            out["miles_remaining"] = remaining
            out["next_milestone"] = nxt
            out["due_status"] = "due_soon" if remaining <= 1000 else "not_due"
        else:
            out["due_status"] = "completed"
            out["interval_value"] = None
    else:
        out["due_status"] = "schedule_known"
        out["interval_value"] = milestones[0] if milestones else None
    return out
