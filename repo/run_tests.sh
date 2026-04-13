#!/bin/bash
set -e

echo "========================================="
echo " LensWork Test Runner"
echo "========================================="

# Export required secrets for the test environment if not already set.
# These are test-only values — never use in production.
export JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 48)}"
export MASTER_ENCRYPTION_KEY="${MASTER_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
export MONGO_INITDB_ROOT_USERNAME="${MONGO_INITDB_ROOT_USERNAME:-lenswork_test}"
export MONGO_INITDB_ROOT_PASSWORD="${MONGO_INITDB_ROOT_PASSWORD:-$(openssl rand -base64 24)}"

# Cleanup from any previous run
echo "[SETUP] Cleaning up previous containers..."
docker compose down --remove-orphans -v 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=repo-") 2>/dev/null || true
docker network rm repo_default 2>/dev/null || true
sleep 1

# Build and start services
echo "[SETUP] Building and starting services..."
docker compose up -d --build

# Wait for server to be healthy
echo "[SETUP] Waiting for server to be ready..."
MAX_RETRIES=60
RETRY=0
until docker compose exec -T server node -e "const http=require('http');const r=http.request({hostname:'localhost',port:3001,path:'/api/health',timeout:2000},res=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1));r.end()" 2>/dev/null; do
  RETRY=$((RETRY+1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "[ERROR] Server failed to start after $MAX_RETRIES retries"
    docker compose logs server
    docker compose down --remove-orphans -v
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

# Run unit tests inside server container (jest installed as devDep)
docker compose exec -T -w /app server sh -c "
  ./node_modules/.bin/jest --roots /unit_tests --testEnvironment node --forceExit --detectOpenHandles --no-cache --cacheDirectory /tmp/jest-cache 2>&1
" && echo "[UNIT] PASS" || { echo "[UNIT] FAIL"; FAILURES=$((FAILURES+1)); }

# ==========================================
# API Tests
# ==========================================
echo ""
echo "========================================="
echo " Running API Tests"
echo "========================================="
echo ""

docker compose exec -T -w /app server sh -c "
  cd /API_tests && API_BASE=http://localhost:3001 /app/node_modules/.bin/jest --forceExit --detectOpenHandles --testTimeout=30000 --no-cache --cacheDirectory /tmp/jest-cache 2>&1
" && echo "[API] PASS" || { echo "[API] FAIL"; FAILURES=$((FAILURES+1)); }

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
docker compose down --remove-orphans -v

exit $FAILURES
