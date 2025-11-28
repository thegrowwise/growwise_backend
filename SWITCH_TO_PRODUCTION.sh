#!/bin/bash

# Script to switch backend from Stripe test mode to production mode

set -e

FUNCTION_NAME="growwise-backend-prod-api"
REGION="us-west-1"

echo "🔄 Switching to Stripe Production Mode"
echo ""

# Check if production keys are provided
if [ -z "$STRIPE_SECRET_KEY" ] || [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
    echo "⚠️  Production Stripe keys not found in environment variables"
    echo ""
    echo "Please provide your production Stripe keys:"
    echo ""
    read -p "Enter Stripe Production Secret Key (sk_live_...): " STRIPE_SECRET_KEY
    read -p "Enter Stripe Production Webhook Secret (whsec_...): " STRIPE_WEBHOOK_SECRET
    echo ""
fi

# Validate keys
if [[ ! "$STRIPE_SECRET_KEY" =~ ^sk_live_ ]]; then
    echo "❌ Error: Secret key should start with 'sk_live_'"
    echo "   You provided: ${STRIPE_SECRET_KEY:0:10}..."
    exit 1
fi

if [[ ! "$STRIPE_WEBHOOK_SECRET" =~ ^whsec_ ]]; then
    echo "❌ Error: Webhook secret should start with 'whsec_'"
    echo "   You provided: ${STRIPE_WEBHOOK_SECRET:0:10}..."
    exit 1
fi

# Load other environment variables from .env if exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -v 'STRIPE' | xargs)
fi

# Confirm before updating
echo "📋 Configuration to update:"
echo "   STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:0:15}..."
echo "   STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:0:15}..."
echo "   FRONTEND_URL: ${FRONTEND_URL:-https://growwiseschool.org}"
echo "   CORS_ORIGIN: ${CORS_ORIGIN:-https://growwiseschool.org}"
echo ""
read -p "Continue with production keys? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Update Lambda function
echo ""
echo "🔄 Updating Lambda function configuration..."
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --environment "Variables={
    NODE_ENV=production,
    STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY},
    STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET},
    SUPABASE_URL=${SUPABASE_URL},
    SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY},
    FRONTEND_URL=${FRONTEND_URL:-https://growwiseschool.org},
    CORS_ORIGIN=${CORS_ORIGIN:-https://growwiseschool.org},
    LOG_LEVEL=info
  }" \
  --output json > /dev/null

echo "✅ Lambda function updated!"
echo ""
echo "📝 Next steps:"
echo "   1. Update frontend NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to production key"
echo "   2. Redeploy frontend"
echo "   3. Test checkout flow"
echo "   4. Verify webhook is receiving events"
echo ""
echo "🔍 Verify the update:"
echo "   aws lambda get-function-configuration \\"
echo "     --function-name $FUNCTION_NAME \\"
echo "     --region $REGION \\"
echo "     --query 'Environment.Variables.STRIPE_SECRET_KEY' \\"
echo "     --output text"

