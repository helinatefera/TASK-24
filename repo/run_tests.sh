#!/bin/bash
set -e

echo "========================================="
echo " LensWork Test Runner"
echo "========================================="

# Generate a temporary .env with test-only secrets. Overrides the dev-default
# secrets in docker-compose.yml so each test run uses a fresh random JWT/key
# and so tests can set LOCK_HOURS=0 and RATE_LIMIT_PER_MIN=10000.
# This file is removed during teardown.
TEST_ENV_FILE=".env.test.generated"
node -e "
const c=require('crypto');
const lines=[
  'JWT_SECRET='+c.randomBytes(36).toString('base64'),
  'MASTER_ENCRYPTION_KEY='+c.randomBytes(32).toString('hex'),
  'MONGO_INITDB_ROOT_USERNAME=lenswork_test',
  'MONGO_INITDB_ROOT_PASSWORD='+c.randomBytes(18).toString('base64url'),
  'LOCK_HOURS=0',
  'RATE_LIMIT_PER_MIN=10000',
];
require('fs').writeFileSync('$TEST_ENV_FILE',lines.join('\n')+'\n');
"
DC="docker compose --env-file $TEST_ENV_FILE"

# Cleanup from any previous run
echo "[SETUP] Cleaning up previous containers..."
$DC down --remove-orphans -v 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=repo-") 2>/dev/null || true
docker network rm repo_default 2>/dev/null || true
sleep 1

# Build and start services
echo "[SETUP] Building and starting services..."
$DC up -d --build

# Wait for server to be healthy
echo "[SETUP] Waiting for server to be ready..."
MAX_RETRIES=60
RETRY=0
until $DC exec -T server node -e "const http=require('http');const r=http.request({hostname:'localhost',port:3001,path:'/api/health',timeout:2000},res=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1));r.end()" 2>/dev/null; do
  RETRY=$((RETRY+1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "[ERROR] Server failed to start after $MAX_RETRIES retries"
    $DC logs server
    $DC down --remove-orphans -v
    exit 1
  fi
  echo "  Waiting... ($RETRY/$MAX_RETRIES)"
  sleep 2
done
echo "[SETUP] Server is ready!"

FAILURES=0

# ==========================================
# Unit Tests
# ==========================================
echo ""
echo "========================================="
echo " Running Unit Tests"
echo "========================================="
echo ""

# Run unit tests inside server container with coverage
$DC exec -T -w /app server sh -c "
  ./node_modules/.bin/jest --roots /unit_tests --testEnvironment node --forceExit --no-cache --cacheDirectory /tmp/jest-cache \
    --coverage --collectCoverageFrom='/app/dist/**/*.js' --coverageDirectory=/tmp/coverage-unit --coverageReporters=text-summary 2>&1
" && echo "[UNIT] PASS" || { echo "[UNIT] FAIL"; FAILURES=$((FAILURES+1)); }

# ==========================================
# API Tests
# ==========================================
echo ""
echo "========================================="
echo " Running API Tests"
echo "========================================="
echo ""

$DC exec -T -w /app server sh -c "
  cd /API_tests && API_BASE=http://localhost:3001 /app/node_modules/.bin/jest --forceExit --testTimeout=30000 --no-cache --cacheDirectory /tmp/jest-cache \
    --coverage --collectCoverageFrom='/app/dist/**/*.js' --coverageDirectory=/tmp/coverage-api --coverageReporters=text-summary 2>&1
" && echo "[API] PASS" || { echo "[API] FAIL"; FAILURES=$((FAILURES+1)); }

# ==========================================
# Client Tests (Vitest)
# ==========================================
echo ""
echo "========================================="
echo " Running Client Tests"
echo "========================================="
echo ""

# Client container runs nginx (no Node.js). Build a temporary image from the
# build stage and run vitest inside it.
docker build --target build -t lenswork-client-test ./client 2>&1 | tail -1
docker run --rm lenswork-client-test sh -c "npx vitest run --coverage 2>&1" \
  && echo "[CLIENT] PASS" || { echo "[CLIENT] FAIL"; FAILURES=$((FAILURES+1)); }

# ==========================================
# Browser E2E Tests (Playwright)
# ==========================================
echo ""
echo "========================================="
echo " Running Browser E2E Tests"
echo "========================================="
echo ""

# Build and run Playwright inside a container on the same Docker network,
# hitting the real frontend+backend through nginx. Zero host dependencies.
# Resolve the compose project name (defaults to the basename of the working
# directory) and use the resulting "<project>_default" network name.
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$(pwd)")}"
NETWORK="${COMPOSE_PROJECT}_default"
# Read test credentials from the generated env file for the E2E container
MONGO_USER=$(grep MONGO_INITDB_ROOT_USERNAME "$TEST_ENV_FILE" | cut -d= -f2)
MONGO_PASS=$(grep MONGO_INITDB_ROOT_PASSWORD "$TEST_ENV_FILE" | cut -d= -f2)
docker build -t lenswork-e2e ./e2e 2>&1 | tail -1
docker run --rm --network "$NETWORK" \
  -e E2E_BASE_URL=https://client:443 \
  -e MONGO_INITDB_ROOT_USERNAME="$MONGO_USER" \
  -e MONGO_INITDB_ROOT_PASSWORD="$MONGO_PASS" \
  lenswork-e2e 2>&1 \
  && echo "[E2E] PASS" || { echo "[E2E] FAIL"; FAILURES=$((FAILURES+1)); }

# ==========================================
# Summary
# ==========================================
echo ""
echo "========================================="
echo " Test Summary"
echo "========================================="

if [ $FAILURES -eq 0 ]; then
  echo " RESULT: ALL TESTS PASSED"
else
  echo " RESULT: $FAILURES TEST SUITE(S) FAILED"
fi

echo "========================================="

# Cleanup
echo "[TEARDOWN] Cleaning up..."
$DC down --remove-orphans -v
rm -f "$TEST_ENV_FILE"

exit $FAILURES
