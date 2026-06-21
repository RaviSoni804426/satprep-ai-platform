FROM python:3.11-slim

# Install system dependencies, PostgreSQL, Redis, Node.js, and npm
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    postgresql \
    postgresql-contrib \
    redis-server \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Configure non-root user for Hugging Face Spaces (UID 1000)
RUN useradd -m -u 1000 user
ENV HOME=/home/user
ENV PATH=/home/user/.local/bin:$PATH
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/satprep
ENV REDIS_URL=redis://localhost:6379/0
ENV ENV=production
ENV OTP_BYPASS=True

# Copy and install python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy and build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm install --no-audit --no-fund --legacy-peer-deps
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Copy backend app and scripts
COPY backend/app/ ./backend/app/
COPY scripts/ ./scripts/

# Setup directories for non-root execution
RUN mkdir -p /app/pg_data /app/redis_data /tmp/postgres_run \
    && chown -R user:user /app /tmp/postgres_run

# Switch to non-root user
USER user

# Set up postgres binaries in user path
ENV PATH="/usr/lib/postgresql/15/bin:$PATH"

EXPOSE 7860

CMD ["bash", "scripts/start_hf.sh"]
