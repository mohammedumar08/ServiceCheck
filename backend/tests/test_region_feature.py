"""
Test suite for US Region Feature - Maintenance Schedule System
Tests: region-profiles, supported-vehicles with regions, debug/match with region params
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "test123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API calls."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestRegionProfiles:
    """Tests for GET /api/estimates/region-profiles endpoint."""
    
    def test_region_profiles_returns_200(self, auth_headers):
        """Region profiles endpoint should return 200."""
        response = requests.get(f"{BASE_URL}/api/estimates/region-profiles", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_region_profiles_contains_ca_and_us(self, auth_headers):
        """Region profiles should contain both CA and US profiles."""
        response = requests.get(f"{BASE_URL}/api/estimates/region-profiles", headers=auth_headers)
        data = response.json()
        
        assert "profiles" in data, "Response should have 'profiles' key"
        profiles = data["profiles"]
        
        region_codes = [p.get("region_code") for p in profiles]
        assert "CA" in region_codes, "CA profile should exist"
        assert "US" in region_codes, "US profile should exist"
    
    def test_ca_profile_has_correct_units(self, auth_headers):
        """CA profile should have km and CAD."""
        response = requests.get(f"{BASE_URL}/api/estimates/region-profiles", headers=auth_headers)
        profiles = response.json()["profiles"]
        
        ca_profile = next((p for p in profiles if p.get("region_code") == "CA"), None)
        assert ca_profile is not None, "CA profile not found"
        assert ca_profile.get("distance_unit") == "km", f"CA should use km, got {ca_profile.get('distance_unit')}"
        assert ca_profile.get("currency_code") == "CAD", f"CA should use CAD, got {ca_profile.get('currency_code')}"
    
    def test_us_profile_has_correct_units(self, auth_headers):
        """US profile should have mi and USD."""
        response = requests.get(f"{BASE_URL}/api/estimates/region-profiles", headers=auth_headers)
        profiles = response.json()["profiles"]
        
        us_profile = next((p for p in profiles if p.get("region_code") == "US"), None)
        assert us_profile is not None, "US profile not found"
        assert us_profile.get("distance_unit") == "mi", f"US should use mi, got {us_profile.get('distance_unit')}"
        assert us_profile.get("currency_code") == "USD", f"US should use USD, got {us_profile.get('currency_code')}"
    
    def test_us_profile_has_schedule_logic(self, auth_headers):
        """US profile should have schedule selection logic."""
        response = requests.get(f"{BASE_URL}/api/estimates/region-profiles", headers=auth_headers)
        profiles = response.json()["profiles"]
        
        us_profile = next((p for p in profiles if p.get("region_code") == "US"), None)
        schedule_logic = us_profile.get("default_schedule_selection_logic", {})
        
        assert schedule_logic.get("normal_schedule_code") == "SCHEDULE_1", "US normal schedule should be SCHEDULE_1"
        assert schedule_logic.get("severe_schedule_code") == "SCHEDULE_2", "US severe schedule should be SCHEDULE_2"


class TestSupportedVehicles:
    """Tests for GET /api/estimates/supported-vehicles endpoint."""
    
    def test_supported_vehicles_returns_200(self, auth_headers):
        """Supported vehicles endpoint should return 200."""
        response = requests.get(f"{BASE_URL}/api/estimates/supported-vehicles", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_supported_vehicles_has_regions_array(self, auth_headers):
        """Each supported vehicle should have a 'regions' array."""
        response = requests.get(f"{BASE_URL}/api/estimates/supported-vehicles", headers=auth_headers)
        data = response.json()
        
        assert "supported_vehicles" in data, "Response should have 'supported_vehicles' key"
        vehicles = data["supported_vehicles"]
        
        assert len(vehicles) > 0, "Should have at least one supported vehicle"
        
        for vehicle in vehicles:
            assert "regions" in vehicle, f"Vehicle {vehicle} should have 'regions' key"
            assert isinstance(vehicle["regions"], list), f"regions should be a list"
    
    def test_mazda_cx5_2022_has_both_regions(self, auth_headers):
        """Mazda CX-5 2022 should have both CA and US regions."""
        response = requests.get(f"{BASE_URL}/api/estimates/supported-vehicles", headers=auth_headers)
        vehicles = response.json()["supported_vehicles"]
        
        cx5_2022 = next((v for v in vehicles if v.get("make") == "Mazda" and v.get("model") == "CX-5" and v.get("year") == 2022), None)
        assert cx5_2022 is not None, "Mazda CX-5 2022 should be in supported vehicles"
        
        regions = cx5_2022.get("regions", [])
        assert "CA" in regions, f"Mazda CX-5 2022 should support CA, got {regions}"
        assert "US" in regions, f"Mazda CX-5 2022 should support US, got {regions}"


class TestDebugMatchUS:
    """Tests for POST /api/estimates/debug/match with US region."""
    
    def test_debug_match_us_tire_rotation_schedule1(self, auth_headers):
        """US tire rotation with Schedule 1 at 42000mi should return correct verdict."""
        payload = {
            "input_line_text": "tire rotation",
            "region_code": "US",
            "schedule_code": "SCHEDULE_1",
            "current_mileage": 42000,
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check verdict
        verdict = data.get("verdict", {})
        assert verdict.get("due_status") == "not_due", f"Expected not_due, got {verdict.get('due_status')}"
        assert verdict.get("interval_value") == 7500, f"Expected interval 7500, got {verdict.get('interval_value')}"
        
        # 42000 % 7500 = 4500, so remaining = 7500 - 4500 = 3000
        assert verdict.get("miles_remaining") == 3000, f"Expected 3000 remaining, got {verdict.get('miles_remaining')}"
    
    def test_debug_match_us_oil_change_condition_based(self, auth_headers):
        """US oil change should return condition_based with wrench_indicator_on trigger."""
        payload = {
            "input_line_text": "oil change",
            "region_code": "US",
            "schedule_code": "SCHEDULE_1",
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        verdict = data.get("verdict", {})
        
        assert verdict.get("due_status") == "condition_based", f"Expected condition_based, got {verdict.get('due_status')}"
        assert verdict.get("trigger_type") == "wrench_indicator_on", f"Expected wrench_indicator_on, got {verdict.get('trigger_type')}"
    
    def test_debug_match_us_spark_plug(self, auth_headers):
        """US spark plug replacement should return correct rule."""
        payload = {
            "input_line_text": "spark plug replacement",
            "region_code": "US",
            "schedule_code": "SCHEDULE_1",
            "current_mileage": 42000,
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Should match spark plug service
        match = data.get("match", {})
        assert match.get("service_key") == "spark_plug_replacement", f"Expected spark_plug_replacement, got {match.get('service_key')}"
        
        # Verdict should have interval value
        verdict = data.get("verdict", {})
        assert verdict.get("interval_value") is not None, "Should have interval_value for spark plugs"
    
    def test_debug_match_us_coolant_flush_first_then_recurring(self, auth_headers):
        """US coolant flush should return first_then_recurring type verdict."""
        payload = {
            "input_line_text": "coolant flush",
            "region_code": "US",
            "schedule_code": "SCHEDULE_1",
            "current_mileage": 42000,
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        verdict = data.get("verdict", {})
        
        # At 42000mi, first interval is 120000mi, so should be not_due
        assert verdict.get("due_status") == "not_due", f"Expected not_due, got {verdict.get('due_status')}"
        assert verdict.get("miles_remaining") is not None, "Should have miles_remaining"
    
    def test_debug_match_us_schedule2_tire_rotation(self, auth_headers):
        """US Schedule 2 tire rotation should return 5000 miles interval."""
        payload = {
            "input_line_text": "tire rotation",
            "region_code": "US",
            "schedule_code": "SCHEDULE_2",
            "current_mileage": 42000,
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        verdict = data.get("verdict", {})
        
        assert verdict.get("interval_value") == 5000, f"Schedule 2 tire rotation should be 5000mi, got {verdict.get('interval_value')}"
        assert verdict.get("severe_only") == True, f"Schedule 2 should be severe_only"


class TestDebugMatchCA:
    """Tests for POST /api/estimates/debug/match with CA region."""
    
    def test_debug_match_ca_tire_rotation(self, auth_headers):
        """CA tire rotation should return interval in km."""
        payload = {
            "input_line_text": "tire rotation",
            "region_code": "CA",
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        verdict = data.get("verdict", {})
        
        # CA tire rotation is 8000 km
        assert verdict.get("interval_value") == 8000, f"CA tire rotation should be 8000km, got {verdict.get('interval_value')}"
        assert verdict.get("interval_unit") == "km", f"CA should use km, got {verdict.get('interval_unit')}"


class TestDebugMatchRuleTrace:
    """Tests for rule_trace in debug/match response."""
    
    def test_debug_match_returns_rule_trace(self, auth_headers):
        """Debug match should return rule_trace with required fields."""
        payload = {
            "input_line_text": "tire rotation",
            "region_code": "US",
            "schedule_code": "SCHEDULE_1",
            "current_mileage": 42000,
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        data = response.json()
        
        rule_trace = data.get("rule_trace", {})
        
        assert "rules_found" in rule_trace, "rule_trace should have rules_found"
        assert "rule_selected" in rule_trace, "rule_trace should have rule_selected"
        assert "schedule_code" in rule_trace, "rule_trace should have schedule_code"
        assert "engine_filter" in rule_trace, "rule_trace should have engine_filter"
        assert "mileage_provided" in rule_trace, "rule_trace should have mileage_provided"
    
    def test_debug_match_returns_verdict_object(self, auth_headers):
        """Debug match should return verdict with required fields."""
        payload = {
            "input_line_text": "tire rotation",
            "region_code": "US",
            "schedule_code": "SCHEDULE_1",
            "current_mileage": 42000,
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        data = response.json()
        
        verdict = data.get("verdict", {})
        
        assert "due_status" in verdict, "verdict should have due_status"
        assert "schedule_used" in verdict, "verdict should have schedule_used"
        assert "interval_value" in verdict, "verdict should have interval_value"
        assert "interval_unit" in verdict, "verdict should have interval_unit"


class TestAuthRequired:
    """Tests that endpoints require authentication."""
    
    def test_region_profiles_requires_auth(self):
        """Region profiles should require authentication."""
        response = requests.get(f"{BASE_URL}/api/estimates/region-profiles")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_supported_vehicles_requires_auth(self):
        """Supported vehicles should require authentication."""
        response = requests.get(f"{BASE_URL}/api/estimates/supported-vehicles")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_debug_match_requires_auth(self):
        """Debug match should require authentication."""
        payload = {"input_line_text": "tire rotation", "region_code": "US"}
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
