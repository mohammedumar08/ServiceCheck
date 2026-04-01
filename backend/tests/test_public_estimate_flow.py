"""
Test suite for Public/Guest Estimate Checker Flow
Tests the new public endpoints that don't require authentication
"""
import pytest
import requests
import os
import io
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test image - simple 1x1 pixel PNG
TEST_IMAGE_BYTES = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
    0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59, 0xE7, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
])


class TestPublicSupportedVehicles:
    """Test GET /api/estimates/public/supported-vehicles - no auth required"""
    
    def test_returns_200_without_auth(self):
        """Public endpoint should return 200 without authentication"""
        response = requests.get(f"{BASE_URL}/api/estimates/public/supported-vehicles")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Public supported-vehicles returns 200 without auth")
    
    def test_returns_supported_vehicles_list(self):
        """Should return list of supported vehicles"""
        response = requests.get(f"{BASE_URL}/api/estimates/public/supported-vehicles")
        data = response.json()
        assert "supported_vehicles" in data, "Response should have 'supported_vehicles' key"
        assert isinstance(data["supported_vehicles"], list), "supported_vehicles should be a list"
        print(f"PASS: Returns {len(data['supported_vehicles'])} supported vehicles")
    
    def test_mazda_cx5_2022_is_supported(self):
        """Mazda CX-5 2022 should be in supported vehicles"""
        response = requests.get(f"{BASE_URL}/api/estimates/public/supported-vehicles")
        data = response.json()
        vehicles = data["supported_vehicles"]
        mazda = next((v for v in vehicles if v["make"] == "Mazda" and v["model"] == "CX-5" and v["year"] == 2022), None)
        assert mazda is not None, "Mazda CX-5 2022 should be supported"
        assert "regions" in mazda, "Vehicle should have regions array"
        print(f"PASS: Mazda CX-5 2022 found with regions: {mazda['regions']}")


class TestPublicRegionProfiles:
    """Test GET /api/estimates/public/region-profiles - no auth required"""
    
    def test_returns_200_without_auth(self):
        """Public endpoint should return 200 without authentication"""
        response = requests.get(f"{BASE_URL}/api/estimates/public/region-profiles")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Public region-profiles returns 200 without auth")
    
    def test_returns_profiles_list(self):
        """Should return list of region profiles"""
        response = requests.get(f"{BASE_URL}/api/estimates/public/region-profiles")
        data = response.json()
        assert "profiles" in data, "Response should have 'profiles' key"
        assert isinstance(data["profiles"], list), "profiles should be a list"
        print(f"PASS: Returns {len(data['profiles'])} region profiles")
    
    def test_contains_us_and_ca_profiles(self):
        """Should contain US and CA region profiles"""
        response = requests.get(f"{BASE_URL}/api/estimates/public/region-profiles")
        data = response.json()
        profiles = data["profiles"]
        region_codes = [p["region_code"] for p in profiles]
        assert "US" in region_codes, "US region should be present"
        assert "CA" in region_codes, "CA region should be present"
        print("PASS: Both US and CA region profiles present")


class TestPublicAnalyzeEstimate:
    """Test POST /api/estimates/public/analyze - no auth required"""
    
    def test_returns_200_with_valid_file(self):
        """Should analyze estimate without authentication"""
        files = {'file': ('test.png', io.BytesIO(TEST_IMAGE_BYTES), 'image/png')}
        data = {
            'make': 'Mazda',
            'model': 'CX-5',
            'year': '2022',
            'region_code': 'CA'
        }
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/analyze",
            files=files,
            data=data,
            timeout=120
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Public analyze returns 200 without auth")
    
    def test_returns_estimate_with_guest_token(self):
        """Should return estimate with guest_token"""
        files = {'file': ('test.png', io.BytesIO(TEST_IMAGE_BYTES), 'image/png')}
        data = {
            'make': 'Mazda',
            'model': 'CX-5',
            'year': '2022',
            'region_code': 'US'
        }
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/analyze",
            files=files,
            data=data,
            timeout=120
        )
        result = response.json()
        assert "estimate" in result, "Response should have 'estimate' key"
        assert "guest_token" in result, "Response should have 'guest_token' key"
        assert result["guest_token"] is not None, "guest_token should not be None"
        assert len(result["guest_token"]) > 0, "guest_token should not be empty"
        print(f"PASS: Returns estimate with guest_token: {result['guest_token'][:8]}...")
    
    def test_estimate_has_no_user_id(self):
        """Guest estimate should have user_id = None"""
        files = {'file': ('test.png', io.BytesIO(TEST_IMAGE_BYTES), 'image/png')}
        data = {
            'make': 'Mazda',
            'model': 'CX-5',
            'year': '2022',
            'region_code': 'CA'
        }
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/analyze",
            files=files,
            data=data,
            timeout=120
        )
        result = response.json()
        estimate = result["estimate"]
        assert estimate.get("user_id") is None, "Guest estimate should have user_id = None"
        print("PASS: Guest estimate has user_id = None")
    
    def test_estimate_has_correct_vehicle_info(self):
        """Estimate should have correct vehicle info"""
        files = {'file': ('test.png', io.BytesIO(TEST_IMAGE_BYTES), 'image/png')}
        data = {
            'make': 'Mazda',
            'model': 'CX-5',
            'year': '2022',
            'region_code': 'US',
            'current_mileage': '45000'
        }
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/analyze",
            files=files,
            data=data,
            timeout=120
        )
        result = response.json()
        estimate = result["estimate"]
        assert estimate["make"] == "Mazda", "Make should be Mazda"
        assert estimate["model"] == "CX-5", "Model should be CX-5"
        assert estimate["year"] == 2022, "Year should be 2022"
        assert estimate["region_code"] == "US", "Region should be US"
        assert estimate["current_mileage"] == 45000, "Mileage should be 45000"
        print("PASS: Estimate has correct vehicle info")


class TestPublicGetResults:
    """Test GET /api/estimates/public/results/{id} - requires guest_token"""
    
    @pytest.fixture
    def guest_estimate(self):
        """Create a guest estimate for testing"""
        files = {'file': ('test.png', io.BytesIO(TEST_IMAGE_BYTES), 'image/png')}
        data = {
            'make': 'Mazda',
            'model': 'CX-5',
            'year': '2022',
            'region_code': 'CA'
        }
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/analyze",
            files=files,
            data=data,
            timeout=120
        )
        return response.json()
    
    def test_returns_200_with_valid_guest_token(self, guest_estimate):
        """Should return estimate results with valid guest_token"""
        estimate_id = guest_estimate["estimate"]["id"]
        guest_token = guest_estimate["guest_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/estimates/public/results/{estimate_id}?guest_token={guest_token}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Public results returns 200 with valid guest_token")
    
    def test_returns_404_with_invalid_guest_token(self, guest_estimate):
        """Should return 404 with invalid guest_token"""
        estimate_id = guest_estimate["estimate"]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/estimates/public/results/{estimate_id}?guest_token=invalid-token"
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Public results returns 404 with invalid guest_token")
    
    def test_returns_404_without_guest_token(self, guest_estimate):
        """Should return 422 without guest_token (required query param)"""
        estimate_id = guest_estimate["estimate"]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/estimates/public/results/{estimate_id}"
        )
        # FastAPI returns 422 for missing required query params
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("PASS: Public results returns 422 without guest_token")
    
    def test_returns_estimate_items_and_summary(self, guest_estimate):
        """Should return estimate, items, and summary"""
        estimate_id = guest_estimate["estimate"]["id"]
        guest_token = guest_estimate["guest_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/estimates/public/results/{estimate_id}?guest_token={guest_token}"
        )
        data = response.json()
        assert "estimate" in data, "Response should have 'estimate' key"
        assert "items" in data, "Response should have 'items' key"
        assert "summary" in data, "Response should have 'summary' key"
        print("PASS: Public results returns estimate, items, and summary")


class TestPublicReanalyze:
    """Test POST /api/estimates/public/results/{id}/reanalyze - requires guest_token"""
    
    @pytest.fixture
    def guest_estimate(self):
        """Create a guest estimate for testing"""
        files = {'file': ('test.png', io.BytesIO(TEST_IMAGE_BYTES), 'image/png')}
        data = {
            'make': 'Mazda',
            'model': 'CX-5',
            'year': '2022',
            'region_code': 'US'
        }
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/analyze",
            files=files,
            data=data,
            timeout=120
        )
        return response.json()
    
    def test_returns_200_with_valid_guest_token(self, guest_estimate):
        """Should reanalyze estimate with valid guest_token"""
        estimate_id = guest_estimate["estimate"]["id"]
        guest_token = guest_estimate["guest_token"]
        
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/results/{estimate_id}/reanalyze?guest_token={guest_token}",
            json={"schedule_code": "SCHEDULE_2"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Public reanalyze returns 200 with valid guest_token")
    
    def test_returns_404_with_invalid_guest_token(self, guest_estimate):
        """Should return 404 with invalid guest_token"""
        estimate_id = guest_estimate["estimate"]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/results/{estimate_id}/reanalyze?guest_token=invalid-token",
            json={"schedule_code": "SCHEDULE_2"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Public reanalyze returns 404 with invalid guest_token")
    
    def test_updates_schedule_code(self, guest_estimate):
        """Should update schedule_code in estimate"""
        estimate_id = guest_estimate["estimate"]["id"]
        guest_token = guest_estimate["guest_token"]
        
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/results/{estimate_id}/reanalyze?guest_token={guest_token}",
            json={"schedule_code": "SCHEDULE_2"}
        )
        data = response.json()
        assert data["estimate"]["schedule_code"] == "SCHEDULE_2", "Schedule code should be updated"
        print("PASS: Public reanalyze updates schedule_code")


class TestPublicClaimEstimate:
    """Test POST /api/estimates/public/claim/{id} - requires auth"""
    
    @pytest.fixture
    def guest_estimate(self):
        """Create a guest estimate for testing"""
        files = {'file': ('test.png', io.BytesIO(TEST_IMAGE_BYTES), 'image/png')}
        data = {
            'make': 'Mazda',
            'model': 'CX-5',
            'year': '2022',
            'region_code': 'CA'
        }
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/analyze",
            files=files,
            data=data,
            timeout=120
        )
        return response.json()
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token by logging in with existing test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "test123"}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        # Try registering a new user
        unique_email = f"test_claim_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "testpass123",
                "name": "Test Claim User"
            }
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not get auth token")
    
    def test_returns_401_without_auth(self, guest_estimate):
        """Should return 401/403 without authentication"""
        estimate_id = guest_estimate["estimate"]["id"]
        guest_token = guest_estimate["guest_token"]
        
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/claim/{estimate_id}",
            json={"guest_token": guest_token}
        )
        # Should require auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Public claim requires authentication")
    
    def test_claims_estimate_with_auth(self, guest_estimate, auth_token):
        """Should claim estimate when authenticated"""
        estimate_id = guest_estimate["estimate"]["id"]
        guest_token = guest_estimate["guest_token"]
        
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/claim/{estimate_id}",
            json={"guest_token": guest_token},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        assert data["id"] == estimate_id, "Response should have estimate id"
        print("PASS: Estimate claimed successfully with auth")
    
    def test_returns_404_for_already_claimed(self, guest_estimate, auth_token):
        """Should return 404 if estimate already claimed"""
        estimate_id = guest_estimate["estimate"]["id"]
        guest_token = guest_estimate["guest_token"]
        
        # First claim
        requests.post(
            f"{BASE_URL}/api/estimates/public/claim/{estimate_id}",
            json={"guest_token": guest_token},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Second claim should fail
        response = requests.post(
            f"{BASE_URL}/api/estimates/public/claim/{estimate_id}",
            json={"guest_token": guest_token},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Already claimed estimate returns 404")


class TestAuthenticatedEndpointsStillRequireAuth:
    """Verify that authenticated endpoints still require auth"""
    
    def test_region_profiles_requires_auth(self):
        """GET /api/estimates/region-profiles should require auth"""
        response = requests.get(f"{BASE_URL}/api/estimates/region-profiles")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Authenticated region-profiles requires auth")
    
    def test_supported_vehicles_requires_auth(self):
        """GET /api/estimates/supported-vehicles should require auth"""
        response = requests.get(f"{BASE_URL}/api/estimates/supported-vehicles")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Authenticated supported-vehicles requires auth")
    
    def test_create_estimate_requires_auth(self):
        """POST /api/estimates should require auth"""
        files = {'file': ('test.png', io.BytesIO(TEST_IMAGE_BYTES), 'image/png')}
        data = {'make': 'Mazda', 'model': 'CX-5', 'year': '2022', 'region_code': 'CA'}
        response = requests.post(f"{BASE_URL}/api/estimates", files=files, data=data)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Authenticated create estimate requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
