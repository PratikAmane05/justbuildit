#!/bin/bash
# deploy.sh — Pull latest code and restart services on EC2
# Run this on EC2: bash deploy.sh

set -e

echo "📦 Pulling latest code..."
git pull origin main

echo "🔑 Copying production .env to backend..."
# Ensure backend/.env has the correct production values
# GOOGLE_REDIRECT_URI should point to this EC2 IP
# FRONTEND_URL should be https://justbuilditai.vercel.app

echo "🐳 Rebuilding and restarting Docker services..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache backend ai_service
docker compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for backend to be healthy..."
sleep 10

echo "🔎 Checking backend health..."
curl -s http://localhost:8002/health | python3 -m json.tool || echo "Health check failed"

echo "🔎 Checking nginx status..."
docker compose -f docker-compose.prod.yml ps

echo "✅ Deployment complete!"
echo ""
echo "🌐 Backend API: http://65.1.168.229/api/v1/docs"
echo "🌐 Frontend:    https://justbuilditai.vercel.app"
