import pytest
from fastapi.testclient import TestClient

def test_register_student(client: TestClient):
    response = client.post("/v1/auth/register", json={
        "email": "test_student@example.com",
        "password": "SecurePassword123!",
        "role": "student",
        "full_name": "Test Student"
    })
    # New flow: registration returns 401 with OTP_REQUIRED
    assert response.status_code == 401
    assert response.json()["detail"] == "OTP_REQUIRED"

def test_register_invalid_role(client: TestClient):
    response = client.post("/v1/auth/register", json={
        "email": "test_invalid@example.com",
        "password": "SecurePassword123!",
        "role": "not_a_role"
    })
    assert response.status_code == 422

def test_registration_approval_flow(client: TestClient):
    # 1. Register student -> returns OTP_REQUIRED (401)
    response = client.post("/v1/auth/register", json={
        "email": "new_student@example.com",
        "password": "SecurePassword123!",
        "role": "student",
        "full_name": "New Student"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "OTP_REQUIRED"
    
    # 2. Verify OTP (using bypass code 123456) -> returns APPROVAL_PENDING (403)
    verify_resp = client.post("/v1/auth/otp/verify", json={
        "email": "new_student@example.com",
        "otp": "123456"
    })
    assert verify_resp.status_code == 403
    assert verify_resp.json()["detail"] == "APPROVAL_PENDING"
    
    # 3. Direct login -> fails with APPROVAL_PENDING (403)
    login_fail = client.post("/v1/auth/login", json={
        "email": "new_student@example.com",
        "password": "SecurePassword123!"
    })
    assert login_fail.status_code == 403
    assert login_fail.json()["detail"] == "APPROVAL_PENDING"
    
    # 4. Admin login to get admin token
    admin_login = client.post("/v1/auth/login", json={
        "email": "admin@satprepai.com",
        "password": "AdminPass123!"
    })
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    
    # Let's find the new user ID from admin users list
    users_resp = client.get("/v1/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert users_resp.status_code == 200
    users = users_resp.json()["data"]
    new_user = next(u for u in users if u["email"] == "new_student@example.com")
    user_id = new_user["id"]
    assert new_user["approval_status"] == "Pending"
    
    # 5. Admin approves the user
    approve_resp = client.post(
        f"/v1/admin/users/{user_id}/approve", 
        json={"notes": "Approved for testing"}, 
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert approve_resp.status_code == 200
    
    # 6. Login now succeeds!
    login_success = client.post("/v1/auth/login", json={
        "email": "new_student@example.com",
        "password": "SecurePassword123!"
    })
    assert login_success.status_code == 200
    assert "access_token" in login_success.json()

def test_suspend_and_reactivate_flow(client: TestClient):
    # 1. Admin login
    admin_login = client.post("/v1/auth/login", json={
        "email": "admin@satprepai.com",
        "password": "AdminPass123!"
    })
    admin_token = admin_login.json()["access_token"]
    
    # 2. Get student user ID
    users_resp = client.get("/v1/users", headers={"Authorization": f"Bearer {admin_token}"})
    users = users_resp.json()["data"]
    student_user = next(u for u in users if u["email"] == "student@satprepai.com")
    user_id = student_user["id"]
    
    # 3. Suspend student
    suspend_resp = client.post(
        f"/v1/admin/users/{user_id}/suspend",
        json={"notes": "Suspending student"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert suspend_resp.status_code == 200
    
    # 4. Attempt login -> should fail with ACCOUNT_SUSPENDED
    login_fail = client.post("/v1/auth/login", json={
        "email": "student@satprepai.com",
        "password": "StudentPass123!"
    })
    assert login_fail.status_code == 403
    assert login_fail.json()["detail"] == "ACCOUNT_SUSPENDED"
    
    # 5. Reactivate student
    reactivate_resp = client.post(
        f"/v1/admin/users/{user_id}/reactivate",
        json={"notes": "Reactivating student"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert reactivate_resp.status_code == 200
    
    # 6. Login succeeds again
    login_success = client.post("/v1/auth/login", json={
        "email": "student@satprepai.com",
        "password": "StudentPass123!"
    })
    assert login_success.status_code == 200

def test_role_enforcement(client: TestClient):
    # 1. Admin login
    admin_login = client.post("/v1/auth/login", json={
        "email": "admin@satprepai.com",
        "password": "AdminPass123!"
    })
    admin_token = admin_login.json()["access_token"]
    
    # 2. Get student user ID and change their role to counsellor
    users_resp = client.get("/v1/users", headers={"Authorization": f"Bearer {admin_token}"})
    users = users_resp.json()["data"]
    student_user = next(u for u in users if u["email"] == "student@satprepai.com")
    user_id = student_user["id"]
    
    role_update = client.patch(
        f"/v1/admin/users/{user_id}/role",
        json={"role": "counsellor"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert role_update.status_code == 200
    assert role_update.json()["role"] == "counsellor"
    
    # 3. Revert student's role back to student
    role_revert = client.patch(
        f"/v1/admin/users/{user_id}/role",
        json={"role": "student"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert role_revert.status_code == 200
    assert role_revert.json()["role"] == "student"
