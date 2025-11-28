#!/bin/bash

# AWS Deployment Script for GrowWise Backend
# This script helps deploy the backend to AWS Lambda

set -e

echo "🚀 Starting AWS Lambda Deployment..."

# Check if serverless is installed
if ! command -v serverless &> /dev/null; then
    echo "❌ Serverless Framework not found. Installing..."
    npm install -g serverless
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Please run: aws configure"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --save serverless-http
npm install --save-dev serverless serverless-offline

# Check if environment variables are set
echo "🔍 Checking environment variables..."
if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo "⚠️  Warning: STRIPE_SECRET_KEY not set. Set it in serverless.yml or use AWS Parameter Store"
fi

if [ -z "$SUPABASE_URL" ]; then
    echo "⚠️  Warning: SUPABASE_URL not set. Set it in serverless.yml or use AWS Parameter Store"
fi

# Deploy
echo "🚀 Deploying to AWS Lambda..."
read -p "Deploy to production? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    serverless deploy --stage prod
else
    serverless deploy --stage dev
fi

echo "✅ Deployment complete!"
echo "📝 Check the output above for your API endpoint URL"


