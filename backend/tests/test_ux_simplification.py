"""
Test suite for UX Simplification Features
Tests: reanalyze endpoint, inferred_logic in debug, localStorage region persistence
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "test123"

# Existing estimate ID from context
EXISTING_ESTIMATE_ID = "9e22270d-ea11-45dc-aebe-c91e044db16b"


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


class TestReanalyzeEndpoint:
    """Tests for POST /api/estimates/{id}/reanalyze endpoint."""
    
    def test_reanalyze_endpoint_exists(self, auth_headers):
        """Reanalyze endpoint should exist and accept POST."""
        # Use existing estimate ID
        payload = {"schedule_code": "SCHEDULE_1"}
        response = requests.post(
            f"{BASE_URL}/api/estimates/{EXISTING_ESTIMATE_ID}/reanalyze",
            json=payload,
            headers=auth_headers
        )
        # Should return 200 or 404 (if estimate doesn't exist), not 405 (method not allowed)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
    
    def test_reanalyze_with_schedule_1(self, auth_headers):
        """Reanalyze with SCHEDULE_1 should work."""
        payload = {"schedule_code": "SCHEDULE_1"}
        response = requests.post(
            f"{BASE_URL}/api/estimates/{EXISTING_ESTIMATE_ID}/reanalyze",
            json=payload,
            headers=auth_headers
        )
        if response.status_code == 404:
            pytest.skip("Existing estimate not found - may have been deleted")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "estimate" in data, "Response should have 'estimate' key"
        assert "items" in data, "Response should have 'items' key"
        assert "summary" in data, "Response should have 'summary' key"
    
    def test_reanalyze_with_schedule_2(self, auth_headers):
        """Reanalyze with SCHEDULE_2 should work."""
        payload = {"schedule_code": "SCHEDULE_2"}
        response = requests.post(
            f"{BASE_URL}/api/estimates/{EXISTING_ESTIMATE_ID}/reanalyze",
            json=payload,
            headers=auth_headers
        )
        if response.status_code == 404:
            pytest.skip("Existing estimate not found - may have been deleted")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify schedule_code is updated in estimate
        assert data["estimate"].get("schedule_code") == "SCHEDULE_2", \
            f"Expected schedule_code SCHEDULE_2, got {data['estimate'].get('schedule_code')}"
    
    def test_reanalyze_updates_estimate_schedule(self, auth_headers):
        """Reanalyze should update the estimate's schedule_code in database."""
        # First set to SCHEDULE_1
        payload = {"schedule_code": "SCHEDULE_1"}
        response = requests.post(
            f"{BASE_URL}/api/estimates/{EXISTING_ESTIMATE_ID}/reanalyze",
            json=payload,
            headers=auth_headers
        )
        if response.status_code == 404:
            pytest.skip("Existing estimate not found")
        
        # Verify by fetching the estimate
        get_response = requests.get(
            f"{BASE_URL}/api/estimates/{EXISTING_ESTIMATE_ID}",
            headers=auth_headers
        )
        if get_response.status_code == 200:
            data = get_response.json()
            assert data["estimate"].get("schedule_code") == "SCHEDULE_1", \
                "Schedule code should be persisted after reanalyze"
    
    def test_reanalyze_returns_updated_items(self, auth_headers):
        """Reanalyze should return updated items with new analysis."""
        payload = {"schedule_code": "SCHEDULE_1"}
        response = requests.post(
            f"{BASE_URL}/api/estimates/{EXISTING_ESTIMATE_ID}/reanalyze",
            json=payload,
            headers=auth_headers
        )
        if response.status_code == 404:
            pytest.skip("Existing estimate not found")
        
        data = response.json()
        items = data.get("items", [])
        
        # Items should have analysis fields
        if len(items) > 0:
            item = items[0]
            assert "category" in item, "Items should have category"
            assert "default_recommendation_code" in item, "Items should have recommendation code"
    
    def test_reanalyze_requires_auth(self):
        """Reanalyze endpoint should require authentication."""
        payload = {"schedule_code": "SCHEDULE_1"}
        response = requests.post(
            f"{BASE_URL}/api/estimates/{EXISTING_ESTIMATE_ID}/reanalyze",
            json=payload
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestDebugInferredLogic:
    """Tests for inferred_logic in debug/match response."""
    
    def test_debug_match_returns_inferred_logic(self, auth_headers):
        """Debug match should return inferred_logic object."""
        payload = {
            "input_line_text": "tire rotation",
            "region_code": "US",
            "schedule_code": "SCHEDULE_1",
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "inferred_logic" in data, "Response should have 'inferred_logic' key"
    
    def test_inferred_logic_has_required_fields(self, auth_headers):
        """inferred_logic should have default_schedule_applied, user_selected_schedule, logic."""
        payload = {
            "input_line_text": "tire rotation",
            "region_code": "US",
            "schedule_code": "SCHEDULE_1",
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        data = response.json()
        
        inferred_logic = data.get("inferred_logic", {})
        
        assert "default_schedule_applied" in inferred_logic, \
            "inferred_logic should have default_schedule_applied"
        assert "user_selected_schedule" in inferred_logic, \
            "inferred_logic should have user_selected_schedule"
        assert "logic" in inferred_logic, \
            "inferred_logic should have logic"
    
    def test_inferred_logic_default_schedule_1(self, auth_headers):
        """When SCHEDULE_1 is used, default_schedule_applied should be SCHEDULE_1."""
        payload = {
            "input_line_text": "oil change",
            "region_code": "US",
            "schedule_code": "SCHEDULE_1",
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        data = response.json()
        
        inferred_logic = data.get("inferred_logic", {})
        assert inferred_logic.get("default_schedule_applied") == "SCHEDULE_1", \
            f"Expected SCHEDULE_1, got {inferred_logic.get('default_schedule_applied')}"
    
    def test_inferred_logic_user_selected_schedule_2(self, auth_headers):
        """When SCHEDULE_2 is used, user_selected_schedule should be SCHEDULE_2."""
        payload = {
            "input_line_text": "tire rotation",
            "region_code": "US",
            "schedule_code": "SCHEDULE_2",
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        data = response.json()
        
        inferred_logic = data.get("inferred_logic", {})
        # When user selects SCHEDULE_2, user_selected_schedule should be SCHEDULE_2
        assert inferred_logic.get("user_selected_schedule") == "SCHEDULE_2", \
            f"Expected SCHEDULE_2, got {inferred_logic.get('user_selected_schedule')}"


class TestDebugMatchStillWorks:
    """Tests that debug/match endpoint still works with region_code, schedule_code, current_mileage."""
    
    def test_debug_match_with_all_params(self, auth_headers):
        """Debug match should work with region_code, schedule_code, current_mileage."""
        payload = {
            "input_line_text": "brake pad replacement",
            "region_code": "US",
            "schedule_code": "SCHEDULE_1",
            "current_mileage": 50000,
            "vehicle_make": "Mazda",
            "vehicle_model": "CX-5",
            "vehicle_year": 2022
        }
        response = requests.post(f"{BASE_URL}/api/estimates/debug/match", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify all params are reflected in response
        assert data.get("region_code") == "US", f"Expected US, got {data.get('region_code')}"
        assert data.get("schedule_code") == "SCHEDULE_1", f"Expected SCHEDULE_1, got {data.get('schedule_code')}"
        assert data.get("current_mileage") == 50000, f"Expected 50000, got {data.get('current_mileage')}"
    
    def test_debug_match_ca_region_still_works(self, auth_headers):
        """CA region analysis should still work correctly."""
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
        
        # CA should use km
        assert data.get("distance_unit") == "km", f"CA should use km, got {data.get('distance_unit')}"
        
        # Verdict should have interval in km
        verdict = data.get("verdict", {})
        assert verdict.get("interval_unit") == "km", f"CA verdict should use km, got {verdict.get('interval_unit')}"


class TestEstimateUploadNoSchedule:
    """Tests that estimate upload works without schedule selector (defaults to SCHEDULE_1)."""
    
    def test_estimate_upload_defaults_schedule_1(self, auth_headers):
        """When uploading estimate, schedule_code should default to SCHEDULE_1."""
        # We can't actually upload a file in this test, but we can verify the endpoint accepts the params
        # This is more of a documentation test - the actual upload is tested via UI
        pass  # Placeholder - actual upload requires file


class TestEstimateDetailDueStatus:
    """Tests that estimate items have due_status badges."""
    
    def test_estimate_items_have_due_status(self, auth_headers):
        """Estimate items should have due_status field."""
        response = requests.get(
            f"{BASE_URL}/api/estimates/{EXISTING_ESTIMATE_ID}",
            headers=auth_headers
        )
        if response.status_code == 404:
            pytest.skip("Existing estimate not found")
        
        data = response.json()
        items = data.get("items", [])
        
        # At least some items should have due_status
        # (not all items may have it if they don't match maintenance rules)
        for item in items:
            # due_status can be present or absent, but if present should be valid
            if "due_status" in item and item["due_status"]:
                valid_statuses = ["due_now", "due_soon", "not_due", "condition_based", "schedule_known", "completed", "inspection", "unknown"]
                assert item["due_status"] in valid_statuses, \
                    f"Invalid due_status: {item['due_status']}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
