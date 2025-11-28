#!/bin/bash

# AWS Elastic Beanstalk Deployment Script
# Alternative deployment method - easier but more expensive

set -e

echo "🚀 Starting AWS Elastic Beanstalk Deployment..."

# Check if EB CLI is installed
if ! command -v eb &> /dev/null; then
    echo "❌ EB CLI not found. Installing..."
    pip install awsebcli
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Please run: aws configure"
    exit 1
fi

# Initialize if not already done
if [ ! -d ".elasticbeanstalk" ]; then
    echo "📝 Initializing Elastic Beanstalk..."
    eb init -p "Node.js 20" growwise-backend --region us-east-1
fi

# Create environment if it doesn't exist
echo "🌍 Creating/updating environment..."
read -p "Environment name (default: growwise-backend-env): " env_name
env_name=${env_name:-growwise-backend-env}

if ! eb list | grep -q "$env_name"; then
    echo "Creating new environment: $env_name"
    eb create "$env_name"
else
    echo "Environment $env_name already exists"
fi

# Set environment variables
echo "🔧 Setting environment variables..."
read -p "Set environment variables now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    eb setenv STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
             STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
             SUPABASE_URL="$SUPABASE_URL" \
             SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
             FRONTEND_URL="$FRONTEND_URL" \
             CORS_ORIGIN="$CORS_ORIGIN" \
             NODE_ENV=production \
             PORT=8080
fi

# Deploy
echo "🚀 Deploying application..."
eb deploy "$env_name"

echo "✅ Deployment complete!"
echo "🌐 Opening application in browser..."
eb open


