import pytest
from fastapi.testclient import TestClient

def test_register_student(client: TestClient):
    response = client.post("/v1/auth/register", json={
        "email": "test_student@example.com",
        "password": "SecurePassword123!",
        "role": "student",
        "full_name": "Test Student"
    })
    assert response.status_code == 201
    assert "access_token" in response.json()

def test_register_invalid_role(client: TestClient):
    response = client.post("/v1/auth/register", json={
        "email": "test_invalid@example.com",
        "password": "SecurePassword123!",
        "role": "not_a_role"
    })
    assert response.status_code == 422

def test_login_success_without_otp(client: TestClient):
    # Register first (auto-verifies user)
    client.post("/v1/auth/register", json={
        "email": "test_unverified@example.com",
        "password": "SecurePassword123!",
        "role": "student"
    })
    
    # Try logging in directly
    response = client.post("/v1/auth/login", json={
        "email": "test_unverified@example.com",
        "password": "SecurePassword123!"
    })
    # Login should succeed immediately without requiring OTP
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_verify_otp_and_login(client: TestClient):
    # Test that verify endpoint is still accessible (returns token) for backwards compatibility
    client.post("/v1/auth/register", json={
        "email": "test_verify@example.com",
        "password": "SecurePassword123!",
        "role": "student",
        "full_name": "Verified Student"
    })
    
    # Verify OTP using bypass code
    verify_resp = client.post("/v1/auth/otp/verify", json={
        "email": "test_verify@example.com",
        "otp": "123456"
    })
    assert verify_resp.status_code == 200
    assert "access_token" in verify_resp.json()
    
    # Login works cleanly
    login_resp = client.post("/v1/auth/login", json={
        "email": "test_verify@example.com",
        "password": "SecurePassword123!"
    })
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()

def test_role_enforcement(client: TestClient):
    # Register student
    client.post("/v1/auth/register", json={
        "email": "student_role@example.com",
        "password": "SecurePassword123!",
        "role": "student"
    })
    
    # Login to get token directly (no OTP needed)
    login_resp = client.post("/v1/auth/login", json={
        "email": "student_role@example.com",
        "password": "SecurePassword123!"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    
    # Access admin endpoint - should be forbidden (403)
    admin_resp = client.get("/v1/admin/questions", headers={"Authorization": f"Bearer {token}"})
    assert admin_resp.status_code == 403
