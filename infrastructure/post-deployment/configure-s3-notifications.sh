#!/bin/bash

# Post-deployment script to configure S3 event notifications
# This script configures automatic document processing triggers

set -e

STAGE=${1:-dev}
REGION=${2:-us-east-1}

echo "Configuring S3 event notifications for stage: $STAGE"

# Get bucket name and Lambda ARN from CDK outputs
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "StrataGPT-Data-$STAGE" \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`DocumentsBucketNameOutput`].OutputValue' \
  --output text)

LAMBDA_ARN=$(aws cloudformation describe-stacks \
  --stack-name "StrataGPT-Processing-$STAGE" \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ProcessingFunctionArn`].OutputValue' \
  --output text)

echo "Bucket: $BUCKET_NAME"
echo "Lambda: $LAMBDA_ARN"

# Create notification configuration
cat > /tmp/notification-config.json <<EOF
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "ProcessPDFDocuments",
      "LambdaFunctionArn": "$LAMBDA_ARN",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "users/"},
            {"Name": "suffix", "Value": ".pdf"}
          ]
        }
      }
    },
    {
      "Id": "ProcessDOCDocuments",
      "LambdaFunctionArn": "$LAMBDA_ARN",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "users/"},
            {"Name": "suffix", "Value": ".doc"}
          ]
        }
      }
    },
    {
      "Id": "ProcessDOCXDocuments",
      "LambdaFunctionArn": "$LAMBDA_ARN",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "users/"},
            {"Name": "suffix", "Value": ".docx"}
          ]
        }
      }
    },
    {
      "Id": "ProcessTXTDocuments",
      "LambdaFunctionArn": "$LAMBDA_ARN",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "users/"},
            {"Name": "suffix", "Value": ".txt"}
          ]
        }
      }
    }
  ]
}
EOF

# Add permission for S3 to invoke Lambda (may already exist from CDK)
echo "Adding Lambda permission for S3..."
aws lambda add-permission \
  --function-name "$LAMBDA_ARN" \
  --principal s3.amazonaws.com \
  --action lambda:InvokeFunction \
  --statement-id "s3-invoke-$(date +%s)" \
  --source-arn "arn:aws:s3:::$BUCKET_NAME" \
  --region $REGION || echo "Permission may already exist"

# Configure S3 bucket notifications
echo "Configuring S3 bucket notifications..."
aws s3api put-bucket-notification-configuration \
  --bucket "$BUCKET_NAME" \
  --notification-configuration file:///tmp/notification-config.json \
  --region $REGION

echo "✅ S3 event notifications configured successfully!"
echo "Documents uploaded to users/ prefix will now trigger automatic processing."

# Clean up
rm -f /tmp/notification-config.json