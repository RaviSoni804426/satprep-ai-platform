# Security Documentation
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. Role-Based Access Control (RBAC)

### Roles

| Role | Description |
|------|-------------|
| student | Takes tests, views own data |
| counsellor | Views assigned students only |
| author | Creates/edits questions (pending approval) |
| admin | Full platform access |

### Permission Matrix

| Resource | Student | Counsellor | Author | Admin |
|---------|---------|-----------|--------|-------|
| Take test | ✅ | ❌ | ❌ | ❌ |
| View own scores | ✅ | ❌ | ❌ | ✅ |
| View assigned student data | ❌ | ✅ | ❌ | ✅ |
| Create questions | ❌ | ❌ | ✅ | ✅ |
| Approve questions | ❌ | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ✅ |
| Configure adaptive rules | ❌ | ❌ | ❌ | ✅ |
| Export reports | ❌ | ✅ (own students) | ❌ | ✅ |

### RBAC Implementation

```python
# JWT payload
{
  "sub": "user_uuid",
  "role": "student",
  "exp": 1737000000
}

# FastAPI dependency
def require_role(*allowed_roles):
    def checker(token: str = Depends(oauth2_scheme)):
        payload = decode_jwt(token)
        if payload["role"] not in allowed_roles:
            raise HTTPException(403, "Insufficient permissions")
    return checker

# Usage on route
@router.get("/admin/users", dependencies=[Depends(require_role("admin"))])
```

---

## 2. JWT Authentication

### Token Design

| Token | TTL | Storage |
|-------|-----|---------|
| Access Token | 15 minutes | Memory (JS variable) |
| Refresh Token | 7 days | HttpOnly Cookie |

### Token Flow

```
Login → Issue access_token + refresh_token
Client: store access_token in memory only (never localStorage)
Every API request: Authorization: Bearer <access_token>

On 401 (expired):
  → Client sends refresh_token (cookie, auto)
  → Server validates + issues new access_token
  → Client retries request
```

### JWT Security Rules
- Signed with RS256 (asymmetric)
- Public key for verification, private key for signing (stored in AWS Secrets Manager)
- `exp`, `iat`, `sub`, `role` claims mandatory
- Refresh tokens invalidated on logout (stored in Redis blocklist)

---

## 3. Encryption

### In Transit
- TLS 1.3 enforced on CloudFront and ALB
- HSTS header enabled (`max-age=31536000; includeSubDomains`)
- HTTP → HTTPS redirect enforced

### At Rest
- RDS: AWS managed encryption (AES-256, KMS)
- S3 buckets: Server-side encryption (SSE-S3)
- Redis: Encryption at rest enabled (AWS ElastiCache)
- No passwords stored in plaintext — bcrypt (cost factor 12)

### Sensitive Field Handling
- PII (email, name) never in application logs
- Question answer keys not returned in API responses (only correct/incorrect flag)
- Score reports signed with server key to prevent tampering

---

## 4. Audit Logs

### What is Logged

| Event | Fields Logged |
|-------|--------------|
| Login success/failure | user_id, IP, timestamp, method |
| Role change | actor_id, target_user_id, old_role, new_role |
| Question approved/rejected | admin_id, question_id, action, timestamp |
| Test started/submitted | student_id, test_id, session_id, timestamp |
| Admin data export | admin_id, export_type, date_range, timestamp |
| Score accessed | user_id, session_id, accessed_at |

### Storage
- Logs streamed to CloudWatch Logs
- Archived to S3 (lifecycle: 90 days hot, 1 year cold/Glacier)
- Immutable after write (S3 Object Lock)

---

## 5. Rate Limiting

| Endpoint | Limit | Window |
|---------|-------|--------|
| POST /auth/login | 5 attempts | Per IP, per 10 min |
| POST /auth/otp/verify | 3 attempts | Per email, per 5 min |
| All API endpoints | 100 requests | Per user, per minute |
| Admin bulk export | 10 requests | Per user, per hour |

**Implementation:** Redis-based sliding window counter  
**Response on breach:** `429 Too Many Requests` + `Retry-After` header

---

## 6. OWASP Top 10 Controls

| OWASP Risk | Control |
|-----------|---------|
| A01: Broken Access Control | RBAC middleware on all routes; student can only access own data |
| A02: Cryptographic Failures | TLS 1.3, AES-256 at rest, bcrypt for passwords |
| A03: Injection | Parameterised queries (SQLAlchemy ORM); no raw SQL |
| A04: Insecure Design | Threat model reviewed in design phase; least-privilege IAM roles |
| A05: Security Misconfiguration | Security headers (CSP, X-Frame-Options, HSTS); no debug in production |
| A06: Vulnerable Components | Dependabot alerts; weekly dependency scan |
| A07: Auth Failures | JWT + OTP; account lockout after 5 failed logins |
| A08: Integrity Failures | Signed score reports; S3 Object Lock for audit logs |
| A09: Logging Failures | All auth + admin events logged; alerts on anomalies |
| A10: SSRF | Whitelist-only outbound connections; no user-supplied URLs fetched |

---

## 7. Additional Controls

### Input Validation
- Pydantic models enforce strict types on all API inputs
- Max lengths enforced on all text fields
- File uploads (question images) validated for MIME type + size (max 2MB)

### Security Headers (all responses)
```
Content-Security-Policy: default-src 'self'; script-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### AWS IAM
- ECS task roles: least privilege (S3 read/write to specific bucket only)
- RDS access: only via VPC private subnet; no public endpoint
- Secrets in AWS Secrets Manager (DB password, JWT private key, API keys)
- No hardcoded credentials anywhere in codebase (enforced via pre-commit hook)
