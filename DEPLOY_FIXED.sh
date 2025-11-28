#!/bin/bash

# Fixed deployment script - includes dependencies properly

set -e

echo "🚀 Deploying with fixed package configuration..."

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set production URLs
export FRONTEND_URL="${FRONTEND_URL:-https://growwiseschool.org}"
export CORS_ORIGIN="${CORS_ORIGIN:-https://growwiseschool.org}"

echo "📋 Environment:"
echo "  Region: us-west-1"
echo "  FRONTEND_URL: $FRONTEND_URL"
echo "  CORS_ORIGIN: $CORS_ORIGIN"
echo ""

# Deploy
echo "🚀 Deploying to AWS Lambda..."
serverless deploy --stage prod

echo ""
echo "✅ Deployment complete!"
echo "📝 Test your endpoint: https://YOUR-API-GATEWAY-URL/"

