#!/bin/bash
set -e

echo "Starting local Redis server..."
redis-server --daemonize yes --dir /app/redis_data

echo "Initializing local PostgreSQL database..."
if [ ! -d "/app/pg_data/PG_VERSION" ]; then
    initdb -D /app/pg_data
fi

echo "Starting local PostgreSQL server..."
pg_ctl -D /app/pg_data -o "-k /tmp/postgres_run" -l /tmp/postgres.log start

# Wait for Postgres to start
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p 5432; do
  sleep 1
done

echo "Configuring PostgreSQL user and database..."
# Create 'user' with password 'pass' and DB 'satprep' if they don't exist
psql -h localhost -p 5432 -d postgres -c "CREATE USER \"user\" WITH SUPERUSER PASSWORD 'pass';" || true
psql -h localhost -p 5432 -d postgres -c "CREATE DATABASE satprep OWNER \"user\";" || true

echo "Seeding database with SAT questions..."
python scripts/seed_db.py

echo "Starting SATPrep AI FastAPI Application on port 7860..."
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 7860
