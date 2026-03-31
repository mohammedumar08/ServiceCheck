"""
Backend tests for PWA (Progressive Web App) features
Tests: manifest.json, service-worker.js, PWA icons accessibility
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://service-check-app.preview.emergentagent.com').rstrip('/')


class TestPWAAssets:
    """Test PWA static assets are accessible"""
    
    def test_manifest_json_accessible(self):
        """GET /manifest.json - PWA manifest is accessible"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        print(f"Manifest response: {response.status_code}")
        assert response.status_code == 200, f"Manifest not accessible: {response.status_code}"
        
        # Verify it's valid JSON
        data = response.json()
        print(f"✓ Manifest accessible and valid JSON")
        
    def test_manifest_has_required_fields(self):
        """Verify manifest.json has all required PWA fields"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        
        data = response.json()
        
        # Required fields for PWA
        assert "name" in data, "Missing 'name' field"
        assert "short_name" in data, "Missing 'short_name' field"
        assert "icons" in data, "Missing 'icons' field"
        assert "start_url" in data, "Missing 'start_url' field"
        assert "display" in data, "Missing 'display' field"
        assert "theme_color" in data, "Missing 'theme_color' field"
        assert "background_color" in data, "Missing 'background_color' field"
        
        print(f"✓ Manifest has all required fields")
        print(f"  - name: {data['name']}")
        print(f"  - short_name: {data['short_name']}")
        print(f"  - display: {data['display']}")
        print(f"  - theme_color: {data['theme_color']}")
        
    def test_manifest_display_standalone(self):
        """Verify manifest display is 'standalone' for app-like experience"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        data = response.json()
        
        assert data["display"] == "standalone", f"Expected display='standalone', got '{data['display']}'"
        print("✓ Display mode is 'standalone'")
        
    def test_manifest_icons_exist(self):
        """Verify manifest icons are defined and accessible"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        data = response.json()
        
        icons = data.get("icons", [])
        assert len(icons) >= 2, f"Expected at least 2 icons, got {len(icons)}"
        
        # Check each icon is accessible
        for icon in icons:
            icon_url = f"{BASE_URL}/{icon['src']}"
            icon_resp = requests.get(icon_url)
            assert icon_resp.status_code == 200, f"Icon not accessible: {icon['src']}"
            print(f"✓ Icon accessible: {icon['src']} ({icon['sizes']})")
            
    def test_service_worker_accessible(self):
        """GET /service-worker.js - Service worker file is accessible"""
        response = requests.get(f"{BASE_URL}/service-worker.js")
        print(f"Service worker response: {response.status_code}")
        assert response.status_code == 200, f"Service worker not accessible: {response.status_code}"
        
        # Verify it contains expected service worker code
        content = response.text
        assert "addEventListener" in content, "Service worker missing event listeners"
        assert "install" in content, "Service worker missing install handler"
        assert "fetch" in content, "Service worker missing fetch handler"
        print("✓ Service worker accessible and contains expected code")
        
    def test_apple_touch_icon_accessible(self):
        """GET /apple-touch-icon.png - Apple touch icon is accessible"""
        response = requests.get(f"{BASE_URL}/apple-touch-icon.png")
        print(f"Apple touch icon response: {response.status_code}")
        assert response.status_code == 200, f"Apple touch icon not accessible: {response.status_code}"
        
        # Verify it's an image
        content_type = response.headers.get("content-type", "")
        assert "image" in content_type, f"Expected image content-type, got {content_type}"
        print("✓ Apple touch icon accessible")
        
    def test_icon_192_accessible(self):
        """GET /icon-192.png - 192x192 icon is accessible"""
        response = requests.get(f"{BASE_URL}/icon-192.png")
        print(f"Icon 192 response: {response.status_code}")
        assert response.status_code == 200, f"Icon 192 not accessible: {response.status_code}"
        print("✓ Icon 192x192 accessible")
        
    def test_icon_512_accessible(self):
        """GET /icon-512.png - 512x512 icon is accessible"""
        response = requests.get(f"{BASE_URL}/icon-512.png")
        print(f"Icon 512 response: {response.status_code}")
        assert response.status_code == 200, f"Icon 512 not accessible: {response.status_code}"
        print("✓ Icon 512x512 accessible")


class TestPWAManifestContent:
    """Test PWA manifest content is correct"""
    
    def test_manifest_start_url(self):
        """Verify start_url is set to root"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        data = response.json()
        
        assert data["start_url"] == "/", f"Expected start_url='/', got '{data['start_url']}'"
        print("✓ start_url is '/'")
        
    def test_manifest_theme_color(self):
        """Verify theme_color is set"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        data = response.json()
        
        theme_color = data.get("theme_color", "")
        assert theme_color.startswith("#"), f"Expected hex color, got '{theme_color}'"
        print(f"✓ theme_color: {theme_color}")
        
    def test_manifest_scope(self):
        """Verify scope is set to root"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        data = response.json()
        
        scope = data.get("scope", "/")
        assert scope == "/", f"Expected scope='/', got '{scope}'"
        print("✓ scope is '/'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
