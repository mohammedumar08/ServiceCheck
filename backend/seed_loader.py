import json
import os
from motor.motor_asyncio import AsyncIOMotorDatabase

SEED_DIR = os.path.join(os.path.dirname(__file__), "seed")


async def seed_collection(db: AsyncIOMotorDatabase, collection_name: str, file_name: str, unique_key_fn):
    filepath = os.path.join(SEED_DIR, file_name)
    with open(filepath, "r") as f:
        records = json.load(f)

    coll = db[collection_name]
    upserted = 0
    for rec in records:
        filt = unique_key_fn(rec)
        result = await coll.update_one(filt, {"$set": rec}, upsert=True)
        if result.upserted_id or result.modified_count:
            upserted += 1

    return upserted


async def run_seed(db: AsyncIOMotorDatabase):
    # service_classification_rules: unique on service_key
    n1 = await seed_collection(
        db, "service_classification_rules", "service_classification_rules.json",
        lambda r: {"service_key": r["service_key"]}
    )

    # service_synonyms: unique on normalized_synonym_text + service_key
    n2 = await seed_collection(
        db, "service_synonyms", "service_synonyms.json",
        lambda r: {"normalized_synonym_text": r["normalized_synonym_text"], "service_key": r["service_key"]}
    )

    # maintenance_schedule_rules: unique on make+model+year+region+service_key+engine
    n3 = await seed_collection(
        db, "maintenance_schedule_rules", "maintenance_schedule_rules.json",
        lambda r: {
            "make": r["make"],
            "model": r["model"],
            "year": r["year"],
            "region": r["region"],
            "service_key": r["service_key"],
            "engine": r.get("engine") or ""
        }
    )

    print(f"Seed complete: {n1} classification rules, {n2} synonyms, {n3} maintenance rules")


async def ensure_indexes(db: AsyncIOMotorDatabase):
    # Classification rules
    await db.service_classification_rules.create_index("service_key", unique=True)

    # Synonyms
    await db.service_synonyms.create_index(
        [("normalized_synonym_text", 1), ("service_key", 1)], unique=True
    )
    await db.service_synonyms.create_index("match_type")

    # Maintenance schedule rules
    await db.maintenance_schedule_rules.create_index(
        [("make", 1), ("model", 1), ("year", 1), ("region", 1), ("service_key", 1), ("engine", 1)]
    )

    # Repair estimates
    await db.repair_estimates.create_index("user_id")
    await db.repair_estimates.create_index([("user_id", 1), ("created_at", -1)])

    # Repair estimate items
    await db.repair_estimate_items.create_index("estimate_id")

    print("Indexes created successfully")
