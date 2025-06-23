#!/bin/bash

# Script to extract CDK deployment outputs and create .env.local file

echo "Setting up environment variables for StrataGPT frontend..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "Error: AWS CLI is not configured. Please configure AWS CLI first."
    exit 1
fi

# Get the stage (default to dev)
STAGE=${1:-dev}
echo "Using stage: $STAGE"

# Extract outputs from CloudFormation stacks
echo "Extracting outputs from CloudFormation stacks..."

# Get Auth Stack outputs
AUTH_STACK_NAME="StrataGPT-Auth-${STAGE}"
echo "Getting outputs from $AUTH_STACK_NAME..."

USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$AUTH_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolIdOutput'].OutputValue" \
    --output text 2>/dev/null)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$AUTH_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientIdOutput'].OutputValue" \
    --output text 2>/dev/null)

IDENTITY_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$AUTH_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='IdentityPoolIdOutput'].OutputValue" \
    --output text 2>/dev/null)

# Get Data Stack outputs
DATA_STACK_NAME="StrataGPT-Data-${STAGE}"
echo "Getting outputs from $DATA_STACK_NAME..."

DOCUMENTS_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "$DATA_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='DocumentsBucketNameOutput'].OutputValue" \
    --output text 2>/dev/null)

PUBLIC_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "$DATA_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='PublicBucketNameOutput'].OutputValue" \
    --output text 2>/dev/null)

DYNAMODB_TABLE=$(aws cloudformation describe-stacks \
    --stack-name "$DATA_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='MainTableNameOutput'].OutputValue" \
    --output text 2>/dev/null)

# Create .env.local file
ENV_FILE=".env.local"
echo "Creating $ENV_FILE..."

cat > "$ENV_FILE" << EOF
# Auto-generated from CloudFormation outputs
# Stage: $STAGE
# Generated at: $(date)

# Cognito Configuration
NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
NEXT_PUBLIC_IDENTITY_POOL_ID=$IDENTITY_POOL_ID
NEXT_PUBLIC_AWS_REGION=us-east-1

# API Configuration
NEXT_PUBLIC_API_ENDPOINT=

# DynamoDB Configuration
NEXT_PUBLIC_DYNAMODB_TABLE_NAME=$DYNAMODB_TABLE

# S3 Configuration
NEXT_PUBLIC_S3_DOCUMENTS_BUCKET=$DOCUMENTS_BUCKET
NEXT_PUBLIC_S3_PUBLIC_BUCKET=$PUBLIC_BUCKET

# OpenAI Configuration
OPENAI_API_KEY=

# Stripe Configuration (for Phase 5)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EOF

# Check if all values were retrieved
if [ -z "$USER_POOL_ID" ] || [ -z "$USER_POOL_CLIENT_ID" ] || [ -z "$IDENTITY_POOL_ID" ] || \
   [ -z "$DOCUMENTS_BUCKET" ] || [ -z "$PUBLIC_BUCKET" ] || [ -z "$DYNAMODB_TABLE" ]; then
    echo "Warning: Some values could not be retrieved from CloudFormation."
    echo "Please ensure the CDK stacks have been deployed."
    echo ""
    echo "Missing values:"
    [ -z "$USER_POOL_ID" ] && echo "  - USER_POOL_ID"
    [ -z "$USER_POOL_CLIENT_ID" ] && echo "  - USER_POOL_CLIENT_ID"
    [ -z "$IDENTITY_POOL_ID" ] && echo "  - IDENTITY_POOL_ID"
    [ -z "$DOCUMENTS_BUCKET" ] && echo "  - DOCUMENTS_BUCKET"
    [ -z "$PUBLIC_BUCKET" ] && echo "  - PUBLIC_BUCKET"
    [ -z "$DYNAMODB_TABLE" ] && echo "  - DYNAMODB_TABLE"
else
    echo "Success! All values retrieved and written to $ENV_FILE"
    echo ""
    echo "Summary:"
    echo "  User Pool ID: $USER_POOL_ID"
    echo "  Client ID: $USER_POOL_CLIENT_ID"
    echo "  Identity Pool ID: $IDENTITY_POOL_ID"
    echo "  Documents Bucket: $DOCUMENTS_BUCKET"
    echo "  Public Bucket: $PUBLIC_BUCKET"
    echo "  DynamoDB Table: $DYNAMODB_TABLE"
fi

echo ""
echo "Note: You still need to add your OpenAI API key and Stripe keys manually."