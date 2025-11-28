#!/bin/bash

# Update Lambda environment variables with production URLs

set -e

FUNCTION_NAME="growwise-backend-prod-api"
REGION="us-west-1"

echo "🔧 Updating Lambda environment variables..."

# Load from .env if exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Update Lambda function
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --environment "Variables={
    NODE_ENV=production,
    STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY},
    STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET},
    SUPABASE_URL=${SUPABASE_URL},
    SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY},
    FRONTEND_URL=https://growwiseschool.org,
    CORS_ORIGIN=https://growwiseschool.org,
    LOG_LEVEL=info
  }" \
  --output json > /dev/null

echo "✅ Environment variables updated!"
echo "   FRONTEND_URL: https://growwiseschool.org"
echo "   CORS_ORIGIN: https://growwiseschool.org"
echo ""
echo "📝 Note: Changes take a few seconds to propagate"

