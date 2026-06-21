# Deployment Documentation
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. AWS Infrastructure Setup

### Region
`ap-south-1` (Mumbai) — primary  
`us-east-1` — DR region (future)

### Core AWS Services

| Service | Purpose |
|---------|---------|
| ECS Fargate | Run FastAPI containers (serverless compute) |
| RDS PostgreSQL (Multi-AZ) | Primary database |
| ElastiCache Redis | Session cache, rate limiting |
| S3 | Static frontend, test snapshots, reports |
| CloudFront | CDN for frontend + API edge caching |
| ALB | Load balancer + SSL termination |
| ECR | Docker image registry |
| CloudWatch | Logs, metrics, alarms |
| Secrets Manager | DB passwords, JWT keys, API credentials |
| Route 53 | DNS management |

---

## 2. VPC Architecture

```
VPC: 10.0.0.0/16
│
├── Public Subnet (10.0.1.0/24, 10.0.2.0/24) — Multi-AZ
│   └── Application Load Balancer
│
├── Private Subnet - App (10.0.3.0/24, 10.0.4.0/24) — Multi-AZ
│   └── ECS Fargate tasks
│   └── RabbitMQ (EC2 or MQ managed)
│
└── Private Subnet - Data (10.0.5.0/24, 10.0.6.0/24) — Multi-AZ
    ├── RDS PostgreSQL (primary + standby)
    ├── ElastiCache Redis cluster
    └── Elasticsearch domain
```

**Security Groups:**
- ALB: Inbound 443 from 0.0.0.0/0
- ECS: Inbound 8000 from ALB SG only
- RDS: Inbound 5432 from ECS SG only
- Redis: Inbound 6379 from ECS SG only

---

## 3. Docker Setup

### Backend Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Frontend Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

### Docker Compose (Local Dev)
```yaml
version: "3.8"
services:
  api:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/satprep
      REDIS_URL: redis://redis:6379
    depends_on: [db, redis]

  frontend:
    build: ./frontend
    ports: ["3000:80"]

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: satprep
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
```

---

## 4. CI/CD Pipeline (GitHub Actions)

### Pipeline Flow
```
Push to main
  → GitHub Actions triggered
  → Run tests (pytest)
  → Build Docker image
  → Push to ECR
  → Deploy to ECS (rolling update)
  → Run smoke tests
  → Notify Slack (success/failure)
```

### GitHub Actions Workflow
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pip install -r requirements.txt
      - run: pytest --cov=app tests/

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Login to ECR
        run: aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI

      - name: Build and push image
        run: |
          docker build -t satprep-api .
          docker tag satprep-api:latest $ECR_URI/satprep-api:$GITHUB_SHA
          docker push $ECR_URI/satprep-api:$GITHUB_SHA

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster satprep-cluster \
            --service satprep-api \
            --force-new-deployment
```

### Branch Strategy
| Branch | Action |
|--------|--------|
| `feature/*` | Run unit tests only |
| `develop` | Run all tests; deploy to staging |
| `main` | Run all tests; deploy to production |

---

## 5. ECS Task Definition (Key Settings)

```json
{
  "family": "satprep-api",
  "cpu": "512",
  "memory": "1024",
  "networkMode": "awsvpc",
  "containerDefinitions": [{
    "name": "satprep-api",
    "image": "<ECR_URI>/satprep-api:latest",
    "portMappings": [{ "containerPort": 8000 }],
    "environment": [
      { "name": "ENV", "value": "production" }
    ],
    "secrets": [
      { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..." },
      { "name": "JWT_PRIVATE_KEY", "valueFrom": "arn:aws:secretsmanager:..." }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/satprep-api",
        "awslogs-region": "ap-south-1"
      }
    }
  }]
}
```

**Auto-scaling:**
- Min tasks: 2, Max tasks: 10
- Scale out: CPU > 70% for 2 min
- Scale in: CPU < 30% for 5 min

---

## 6. Monitoring & Alerting

### CloudWatch Alarms

| Alarm | Threshold | Action |
|-------|-----------|--------|
| API error rate | > 5% in 5 min | SNS → PagerDuty |
| ECS CPU | > 80% sustained | Auto-scale + Slack alert |
| RDS connections | > 80% max | Slack alert |
| Score queue lag | > 100 messages | Slack alert |
| P95 API latency | > 1 second | Slack alert |

### Key Metrics Tracked
- API request count and error rate (per endpoint)
- ECS task CPU and memory utilisation
- RDS read/write IOPS and connection count
- Redis cache hit rate (target: > 85%)
- RabbitMQ queue depth

---

## 7. Database Migrations

**Tool:** Alembic (with SQLAlchemy)

```bash
# Create migration
alembic revision --autogenerate -m "add_recommendations_table"

# Apply migrations (runs in ECS before app starts)
alembic upgrade head
```

**Zero-downtime migration rules:**
- Additive changes first (add columns as NULLABLE)
- Backfill data in a background job
- Make column NOT NULL only after backfill complete
- Never rename or drop columns in a single deploy

---

## 8. Backup & Disaster Recovery

### Backup

| Resource | Backup Method | Frequency | Retention |
|---------|--------------|-----------|-----------|
| RDS | Automated snapshots | Daily | 7 days |
| RDS | Manual snapshot | Pre-release | 30 days |
| S3 (test snapshots) | Versioning enabled | Continuous | 90 days |
| S3 (score reports) | Cross-region replication | Continuous | 1 year |

### Recovery Targets
- **RTO (Recovery Time Objective):** < 1 hour
- **RPO (Recovery Point Objective):** < 15 minutes

### Disaster Recovery Plan
```
1. RDS fail: Multi-AZ auto-failover (< 60s, automatic)
2. ECS fail: ECS restarts tasks automatically; ALB removes unhealthy targets
3. Redis fail: ECS falls back to DB (session loaded from S3 snapshot)
4. Full region failure: Restore from RDS snapshot + S3 in us-east-1
   Estimated manual DR time: 45–90 minutes
```
