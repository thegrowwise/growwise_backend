#!/bin/bash

# Script to redeploy to the correct region (us-west-1) with proper environment variables

set -e

echo "🚀 Redeploying to us-west-1 with environment variables..."

# Load environment variables from .env if it exists
if [ -f .env ]; then
    echo "📝 Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Set production values for FRONTEND_URL and CORS_ORIGIN if they're still localhost
if [ "$FRONTEND_URL" = "http://localhost:3003" ] || [ -z "$FRONTEND_URL" ]; then
    export FRONTEND_URL="https://growwiseschool.org"
    echo "✅ Set FRONTEND_URL to https://growwiseschool.org"
fi

if [ "$CORS_ORIGIN" = "http://localhost:3000" ] || [ -z "$CORS_ORIGIN" ]; then
    export CORS_ORIGIN="https://growwiseschool.org"
    echo "✅ Set CORS_ORIGIN to https://growwiseschool.org"
fi

# Verify required variables are set
if [ -z "$STRIPE_SECRET_KEY" ] || [ -z "$SUPABASE_URL" ]; then
    echo "❌ Error: Required environment variables not set!"
    echo "Please set: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY"
    exit 1
fi

echo ""
echo "📋 Environment variables:"
echo "  STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:0:20}..."
echo "  SUPABASE_URL: $SUPABASE_URL"
echo "  FRONTEND_URL: $FRONTEND_URL"
echo "  CORS_ORIGIN: $CORS_ORIGIN"
echo ""

# Deploy to us-west-1
echo "🚀 Deploying to us-west-1..."
serverless deploy --stage prod --region us-west-1

echo ""
echo "✅ Deployment complete!"
echo "📝 Your API endpoint will be shown above"

