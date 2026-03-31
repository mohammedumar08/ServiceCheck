"""Tests for estimate_analyzer normalization and matching pipeline."""
import pytest
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from services.estimate_analyzer import deep_normalize, normalize_text, match_service_key, analyze_estimate_item

pytestmark = pytest.mark.asyncio


# --- Unit tests for deep_normalize (no DB needed) ---

class TestDeepNormalize:
    def test_strip_dealer_code_fu03(self):
        assert deep_normalize("FU03 Fuel Injectors - Clean - REC EVERY16MTH/32K") == "fuel injector cleaning"

    def test_strip_dealer_code_bg01(self):
        result = deep_normalize("BG01 Brake Pad Replacement - REC EVERY 12MTH")
        assert result == "brake pad replacement"

    def test_strip_dealer_code_tr02(self):
        result = deep_normalize("TR02 Tire Rotation - REC EVERY 10K")
        assert result == "tire rotation"

    def test_strip_dealer_code_ac01(self):
        result = deep_normalize("AC01 Air Conditioning Service")
        assert result == "air conditioning service"

    def test_no_dealer_code(self):
        assert deep_normalize("Fuel Injector Cleaning") == "fuel injector cleaning"

    def test_plural_normalization(self):
        assert deep_normalize("Fuel Injectors") == "fuel injector"

    def test_verb_clean_to_cleaning(self):
        assert "cleaning" in deep_normalize("Injectors Clean")

    def test_hyphens_replaced(self):
        result = deep_normalize("Fuel Injectors - Clean")
        assert "-" not in result
        assert "fuel injector cleaning" == result

    def test_noise_rec_every(self):
        result = deep_normalize("Something - REC EVERY 6MTH/10K")
        assert "rec" not in result
        assert "mth" not in result

    def test_noise_complex_interval(self):
        result = deep_normalize("FU03 Fuel Injectors - Clean - REC EVERY16MTH/32K")
        assert "16" not in result
        assert "32" not in result

    def test_preserves_core_words(self):
        result = deep_normalize("Oil Change with Filter")
        assert "oil" in result
        assert "change" in result
        assert "filter" in result


# --- Integration tests using direct asyncio.run ---

def _get_db():
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    return client, client[os.environ.get("DB_NAME", "test_database")]


class TestMatchServiceKey:
    """Tests that require synonym data in DB."""

    def test_messy_dealer_fuel_injector(self):
        async def _run():
            client, db = _get_db()
            result = await match_service_key(db, "FU03 Fuel Injectors - Clean - REC EVERY16MTH/32K")
            client.close()
            return result
        result = asyncio.run(_run())
        assert result["service_key"] == "fuel_injector_cleaning"
        assert result["confidence"] >= 0.8

    def test_clean_fuel_injector_cleaning(self):
        async def _run():
            client, db = _get_db()
            result = await match_service_key(db, "Fuel Injector Cleaning")
            client.close()
            return result
        result = asyncio.run(_run())
        assert result["service_key"] == "fuel_injector_cleaning"
        assert result["match_strategy"] == "exact"
        assert result["confidence"] == 1.0

    def test_injector_flush(self):
        async def _run():
            client, db = _get_db()
            result = await match_service_key(db, "Injector Flush")
            client.close()
            return result
        result = asyncio.run(_run())
        assert result["service_key"] == "fuel_injector_cleaning"
        assert result["confidence"] >= 0.8

    def test_fuel_system_cleaning(self):
        async def _run():
            client, db = _get_db()
            result = await match_service_key(db, "Fuel System Cleaning")
            client.close()
            return result
        result = asyncio.run(_run())
        assert result["service_key"] == "fuel_injector_cleaning"

    def test_oil_change(self):
        async def _run():
            client, db = _get_db()
            result = await match_service_key(db, "Oil Change")
            client.close()
            return result
        result = asyncio.run(_run())
        assert result["service_key"] == "engine_oil_change"

    def test_brake_pad_with_dealer_code(self):
        async def _run():
            client, db = _get_db()
            result = await match_service_key(db, "BG01 Brake Pad Replacement - REC EVERY 12MTH")
            client.close()
            return result
        result = asyncio.run(_run())
        assert result["service_key"] == "brake_pad_replacement"

    def test_tire_rotation_with_dealer_code(self):
        async def _run():
            client, db = _get_db()
            result = await match_service_key(db, "TR02 Tire Rotation - REC EVERY 10K")
            client.close()
            return result
        result = asyncio.run(_run())
        assert result["service_key"] == "tire_rotation"

    def test_no_match_gibberish(self):
        async def _run():
            client, db = _get_db()
            result = await match_service_key(db, "XYZABC Random Gibberish")
            client.close()
            return result
        result = asyncio.run(_run())
        assert result["service_key"] is None
        assert result["match_strategy"] == "none"


class TestAnalyzeEstimateItem:
    """Full pipeline tests."""

    def test_full_pipeline_fuel_injector(self):
        async def _run():
            client, db = _get_db()
            vehicle = {"make": "Toyota", "model": "Camry", "year": 2020}
            result = await analyze_estimate_item(
                db, "FU03 Fuel Injectors - Clean - REC EVERY16MTH/32K", 89.99, vehicle
            )
            client.close()
            return result
        result = asyncio.run(_run())
        assert result["service_key"] == "fuel_injector_cleaning"
        assert result["display_name"] == "Fuel Injector Cleaning"
        assert result["category"] != "unknown"
        assert result["recommendation"] != "cannot_determine"
        assert result["normalized_text"] == "fuel injector cleaning"
        assert result["match_confidence"] >= 0.8

    def test_full_pipeline_unmatched(self):
        async def _run():
            client, db = _get_db()
            vehicle = {"make": "Toyota", "model": "Camry", "year": 2020}
            result = await analyze_estimate_item(db, "Miscellaneous shop supplies", 999.99, vehicle)
            client.close()
            return result
        result = asyncio.run(_run())
        assert result["service_key"] is None
        assert result["category"] == "unknown"
        assert result["recommendation"] == "cannot_determine"
