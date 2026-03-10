#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class CarServiceAPITester:
    def __init__(self, base_url: str = "https://service-check-app.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'vehicle_id': None,
            'service_record_id': None,
            'reminder_id': None
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            print(f"❌ {name}: FAILED {details}")
        return success

    def make_request(self, method: str, endpoint: str, data: Dict[Any, Any] = None, 
                    expected_status: int = 200, files: Dict = None) -> tuple[bool, Dict[Any, Any]]:
        """Make HTTP request with error handling"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if files:
            # For file uploads, don't set Content-Type (requests will set it)
            headers.pop('Content-Type', None)

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, headers=headers, data=data, files=files)
                else:
                    response = requests.post(url, headers=headers, json=data)
            elif method == 'PUT':
                response = requests.put(url, headers=headers, json=data)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                return False, {'error': f'Unsupported method: {method}'}

            success = response.status_code == expected_status
            
            try:
                json_data = response.json() if response.text else {}
            except:
                json_data = {'raw_response': response.text}
                
            return success, json_data

        except Exception as e:
            return False, {'error': str(e)}

    # ==================== AUTH TESTS ====================
    
    def test_root_endpoint(self):
        """Test API root endpoint"""
        success, data = self.make_request('GET', '/')
        return self.log_test("API Root", success, f"- {data.get('message', 'No message')}")

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_user = {
            "email": f"test_user_{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Test User {timestamp}"
        }
        
        success, data = self.make_request('POST', '/auth/register', test_user, 200)
        
        if success and 'access_token' in data:
            self.token = data['access_token']
            self.user_id = data['user']['id']
            return self.log_test("User Registration", True, f"- Token received for {test_user['email']}")
        else:
            return self.log_test("User Registration", False, f"- {data}")

    def test_user_login(self):
        """Test user login with existing credentials"""
        if not self.user_id:
            return self.log_test("User Login", False, "- No user created to test login")
            
        # Use the same credentials from registration test
        timestamp = datetime.now().strftime('%H%M%S')
        login_data = {
            "email": f"test_user_{timestamp}@example.com",
            "password": "TestPass123!"
        }
        
        success, data = self.make_request('POST', '/auth/login', login_data, 200)
        
        if success and 'access_token' in data:
            self.token = data['access_token']
            return self.log_test("User Login", True, f"- Login successful")
        else:
            return self.log_test("User Login", False, f"- {data}")

    def test_get_user_profile(self):
        """Test get current user profile"""
        if not self.token:
            return self.log_test("Get User Profile", False, "- No token available")
            
        success, data = self.make_request('GET', '/auth/me')
        return self.log_test("Get User Profile", success and 'email' in data, 
                           f"- User: {data.get('email', 'Unknown')}")

    # ==================== VEHICLE TESTS ====================
    
    def test_create_vehicle(self):
        """Test creating a vehicle"""
        if not self.token:
            return self.log_test("Create Vehicle", False, "- No token available")
            
        vehicle_data = {
            "make": "Toyota",
            "model": "Camry",
            "year": 2020,
            "license_plate": "TEST123",
            "color": "Silver",
            "notes": "Test vehicle"
        }
        
        success, data = self.make_request('POST', '/vehicles', vehicle_data, 200)
        
        if success and 'id' in data:
            self.created_resources['vehicle_id'] = data['id']
            return self.log_test("Create Vehicle", True, 
                               f"- Created {data['year']} {data['make']} {data['model']}")
        else:
            return self.log_test("Create Vehicle", False, f"- {data}")

    def test_get_vehicles(self):
        """Test getting vehicles list"""
        if not self.token:
            return self.log_test("Get Vehicles", False, "- No token available")
            
        success, data = self.make_request('GET', '/vehicles')
        
        if success and isinstance(data, list):
            return self.log_test("Get Vehicles", True, f"- Found {len(data)} vehicles")
        else:
            return self.log_test("Get Vehicles", False, f"- {data}")

    def test_get_vehicle_by_id(self):
        """Test getting specific vehicle"""
        vehicle_id = self.created_resources.get('vehicle_id')
        if not vehicle_id:
            return self.log_test("Get Vehicle by ID", False, "- No vehicle created to test")
            
        success, data = self.make_request('GET', f'/vehicles/{vehicle_id}')
        return self.log_test("Get Vehicle by ID", success and data.get('id') == vehicle_id,
                           f"- Vehicle: {data.get('make', 'Unknown')} {data.get('model', 'Unknown')}")

    def test_update_vehicle(self):
        """Test updating vehicle"""
        vehicle_id = self.created_resources.get('vehicle_id')
        if not vehicle_id:
            return self.log_test("Update Vehicle", False, "- No vehicle created to test")
            
        update_data = {"color": "Blue", "notes": "Updated test vehicle"}
        success, data = self.make_request('PUT', f'/vehicles/{vehicle_id}', update_data)
        return self.log_test("Update Vehicle", success and data.get('color') == "Blue",
                           f"- Updated color to {data.get('color', 'Unknown')}")

    # ==================== SERVICE RECORD TESTS ====================
    
    def test_create_service_record(self):
        """Test creating a service record"""
        vehicle_id = self.created_resources.get('vehicle_id')
        if not vehicle_id:
            return self.log_test("Create Service Record", False, "- No vehicle available")
            
        service_data = {
            "vehicle_id": vehicle_id,
            "service_type": "Oil Change",
            "date": "2024-01-15",
            "price": 75.99,
            "location": "Quick Lube Center",
            "odometer": 50000,
            "notes": "Test service record",
            "provider": "Test Shop"
        }
        
        success, data = self.make_request('POST', '/service-records', service_data, 200)
        
        if success and 'id' in data:
            self.created_resources['service_record_id'] = data['id']
            return self.log_test("Create Service Record", True, 
                               f"- Created {data['service_type']} for ${data['price']}")
        else:
            return self.log_test("Create Service Record", False, f"- {data}")

    def test_get_service_records(self):
        """Test getting service records"""
        if not self.token:
            return self.log_test("Get Service Records", False, "- No token available")
            
        success, data = self.make_request('GET', '/service-records')
        
        if success and isinstance(data, list):
            return self.log_test("Get Service Records", True, f"- Found {len(data)} records")
        else:
            return self.log_test("Get Service Records", False, f"- {data}")

    def test_get_service_record_by_id(self):
        """Test getting specific service record"""
        record_id = self.created_resources.get('service_record_id')
        if not record_id:
            return self.log_test("Get Service Record by ID", False, "- No service record created")
            
        success, data = self.make_request('GET', f'/service-records/{record_id}')
        return self.log_test("Get Service Record by ID", success and data.get('id') == record_id,
                           f"- Record: {data.get('service_type', 'Unknown')}")

    def test_update_service_record(self):
        """Test updating service record"""
        record_id = self.created_resources.get('service_record_id')
        if not record_id:
            return self.log_test("Update Service Record", False, "- No service record created")
            
        update_data = {"price": 85.99, "notes": "Updated test service"}
        success, data = self.make_request('PUT', f'/service-records/{record_id}', update_data)
        return self.log_test("Update Service Record", success and data.get('price') == 85.99,
                           f"- Updated price to ${data.get('price', 0)}")

    # ==================== REMINDER TESTS ====================
    
    def test_create_reminder(self):
        """Test creating a reminder"""
        vehicle_id = self.created_resources.get('vehicle_id')
        if not vehicle_id:
            return self.log_test("Create Reminder", False, "- No vehicle available")
            
        future_date = (datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')
        reminder_data = {
            "vehicle_id": vehicle_id,
            "service_type": "Oil Change",
            "due_date": future_date,
            "due_odometer": 60000,
            "notes": "Test reminder"
        }
        
        success, data = self.make_request('POST', '/reminders', reminder_data, 200)
        
        if success and 'id' in data:
            self.created_resources['reminder_id'] = data['id']
            return self.log_test("Create Reminder", True, 
                               f"- Created {data['service_type']} reminder")
        else:
            return self.log_test("Create Reminder", False, f"- {data}")

    def test_get_reminders(self):
        """Test getting reminders"""
        if not self.token:
            return self.log_test("Get Reminders", False, "- No token available")
            
        success, data = self.make_request('GET', '/reminders')
        
        if success and isinstance(data, list):
            return self.log_test("Get Reminders", True, f"- Found {len(data)} reminders")
        else:
            return self.log_test("Get Reminders", False, f"- {data}")

    def test_update_reminder_complete(self):
        """Test marking reminder as complete"""
        reminder_id = self.created_resources.get('reminder_id')
        if not reminder_id:
            return self.log_test("Complete Reminder", False, "- No reminder created")
            
        update_data = {"completed": True}
        success, data = self.make_request('PUT', f'/reminders/{reminder_id}', update_data)
        return self.log_test("Complete Reminder", success and data.get('completed') == True,
                           f"- Reminder marked as complete")

    # ==================== EXPORT TESTS ====================
    
    def test_export_csv(self):
        """Test CSV export"""
        if not self.token:
            return self.log_test("Export CSV", False, "- No token available")
            
        try:
            url = f"{self.api_url}/export/csv"
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(url, headers=headers)
            
            success = response.status_code == 200 and 'text/csv' in response.headers.get('Content-Type', '')
            return self.log_test("Export CSV", success, f"- Response size: {len(response.content)} bytes")
        except Exception as e:
            return self.log_test("Export CSV", False, f"- Error: {str(e)}")

    def test_export_json(self):
        """Test JSON export"""
        if not self.token:
            return self.log_test("Export JSON", False, "- No token available")
            
        success, data = self.make_request('GET', '/export/json')
        
        if success and 'vehicles' in data and 'service_records' in data:
            return self.log_test("Export JSON", True, 
                               f"- Exported {len(data.get('vehicles', []))} vehicles, {len(data.get('service_records', []))} records")
        else:
            return self.log_test("Export JSON", False, f"- {data}")

    # ==================== DASHBOARD TESTS ====================
    
    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        if not self.token:
            return self.log_test("Dashboard Stats", False, "- No token available")
            
        success, data = self.make_request('GET', '/stats/dashboard')
        
        expected_keys = ['total_vehicles', 'total_services', 'total_spent', 'upcoming_reminders']
        has_all_keys = all(key in data for key in expected_keys)
        
        return self.log_test("Dashboard Stats", success and has_all_keys,
                           f"- Vehicles: {data.get('total_vehicles', 0)}, Services: {data.get('total_services', 0)}")

    # ==================== CLEANUP TESTS ====================
    
    def test_cleanup_resources(self):
        """Clean up created resources"""
        cleanup_success = True
        
        # Delete service record
        if self.created_resources.get('service_record_id'):
            success, _ = self.make_request('DELETE', f"/service-records/{self.created_resources['service_record_id']}", expected_status=200)
            if not success:
                cleanup_success = False
                
        # Delete reminder
        if self.created_resources.get('reminder_id'):
            success, _ = self.make_request('DELETE', f"/reminders/{self.created_resources['reminder_id']}", expected_status=200)
            if not success:
                cleanup_success = False
                
        # Delete vehicle (this should cascade delete related records)
        if self.created_resources.get('vehicle_id'):
            success, _ = self.make_request('DELETE', f"/vehicles/{self.created_resources['vehicle_id']}", expected_status=200)
            if not success:
                cleanup_success = False
        
        return self.log_test("Cleanup Resources", cleanup_success, "- All test resources cleaned up")

    # ==================== MAIN TEST RUNNER ====================
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"🚀 Starting Car Service Tracker API Tests")
        print(f"📡 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Basic connectivity
        if not self.test_root_endpoint():
            print("❌ API not accessible, stopping tests")
            return False
            
        # Authentication tests
        if not self.test_user_registration():
            print("❌ User registration failed, stopping tests")
            return False
            
        self.test_get_user_profile()
        
        # Vehicle management tests
        if not self.test_create_vehicle():
            print("❌ Vehicle creation failed, skipping vehicle-dependent tests")
            return False
            
        self.test_get_vehicles()
        self.test_get_vehicle_by_id()
        self.test_update_vehicle()
        
        # Service record tests
        self.test_create_service_record()
        self.test_get_service_records()
        self.test_get_service_record_by_id()
        self.test_update_service_record()
        
        # Reminder tests
        self.test_create_reminder()
        self.test_get_reminders()
        self.test_update_reminder_complete()
        
        # Export tests
        self.test_export_csv()
        self.test_export_json()
        
        # Dashboard tests
        self.test_dashboard_stats()
        
        # Cleanup
        self.test_cleanup_resources()
        
        # Print results
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("🎉 Excellent! API is working well.")
        elif success_rate >= 75:
            print("✅ Good! API is mostly functional with minor issues.")
        elif success_rate >= 50:
            print("⚠️  Warning! API has significant issues.")
        else:
            print("❌ Critical! API is not functioning properly.")
            
        return success_rate >= 75


def main():
    """Main test execution"""
    tester = CarServiceAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())