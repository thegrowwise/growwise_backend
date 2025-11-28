#!/bin/bash

# Script to update Lambda environment variables
# Run this after setting your environment variables

set -e

FUNCTION_NAME="growwise-backend-prod-api"
REGION="us-west-1"

echo "🔧 Updating Lambda environment variables..."

# Check if environment variables are set
if [ -z "$STRIPE_SECRET_KEY" ] || [ -z "$SUPABASE_URL" ]; then
    echo "⚠️  Warning: Some environment variables are not set."
    echo "Please set them before running this script:"
    echo ""
    echo "export STRIPE_SECRET_KEY='your_key'"
    echo "export STRIPE_WEBHOOK_SECRET='your_secret'"
    echo "export SUPABASE_URL='your_url'"
    echo "export SUPABASE_ANON_KEY='your_key'"
    echo "export FRONTEND_URL='https://your-frontend-domain.com'"
    echo "export CORS_ORIGIN='https://your-frontend-domain.com'"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update Lambda function configuration
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --environment "Variables={
    NODE_ENV=production,
    STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-},
    STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-},
    SUPABASE_URL=${SUPABASE_URL:-},
    SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-},
    FRONTEND_URL=${FRONTEND_URL:-https://growwiseschool.org},
    CORS_ORIGIN=${CORS_ORIGIN:-https://growwiseschool.org},
    LOG_LEVEL=info
  }" \
  --output json

echo ""
echo "✅ Environment variables updated!"
echo "📝 Note: It may take a few seconds for changes to propagate"

