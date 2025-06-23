#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/stacks/auth-stack';
import { DirectAccessStack } from '../lib/stacks/direct-access-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { ProcessingStack } from '../lib/stacks/processing-stack';
import { getEnvironmentConfig, getStackName } from '../lib/config/environment';

const app = new cdk.App();

// Get stage from context or environment
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';
const config = getEnvironmentConfig(stage);

// Define common stack props
const commonProps: cdk.StackProps = {
  env: {
    account: config.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: config.region || process.env.CDK_DEFAULT_REGION,
  },
  description: `StrataGPT Infrastructure Stack - ${stage}`,
  tags: {
    Project: 'StrataGPT',
    Stage: stage,
    ManagedBy: 'CDK',
  },
};

// Create stacks in dependency order
// 1. Auth Stack - Cognito User Pool and Identity Pool
const authStack = new AuthStack(app, getStackName('Auth', stage), {
  ...commonProps,
  config,
});

// 2. Data Stack - DynamoDB and S3 buckets
const dataStack = new DataStack(app, getStackName('Data', stage), {
  ...commonProps,
  config,
});

// 3. Direct Access Stack - IAM policies for Identity Pool roles
const directAccessStack = new DirectAccessStack(app, getStackName('DirectAccess', stage), {
  ...commonProps,
  config,
  authenticatedRoleArn: authStack.authenticatedRole.roleArn,
  unauthenticatedRoleArn: authStack.unauthenticatedRole.roleArn,
  userPoolArn: authStack.userPool.userPoolArn,
});

// 4. Processing Stack - Lambda functions for document processing
const processingStack = new ProcessingStack(app, getStackName('Processing', stage), {
  ...commonProps,
  config,
  mainTable: dataStack.mainTable,
  documentsBucket: dataStack.documentsBucket,
  processedBucket: dataStack.processedDocumentsBucket, // Using dedicated processed documents bucket
});


// Add explicit dependencies
directAccessStack.addDependency(authStack);
directAccessStack.addDependency(dataStack);
processingStack.addDependency(dataStack);

// Add descriptions to help with deployment
authStack.node.addMetadata('Description', 
  'Authentication infrastructure including Cognito User Pool and Identity Pool');
dataStack.node.addMetadata('Description', 
  'Data storage infrastructure including DynamoDB tables and S3 buckets');
directAccessStack.node.addMetadata('Description', 
  'IAM policies and roles for direct client access to AWS services');
processingStack.node.addMetadata('Description',
  'Document processing pipeline with Lambda, Textract and S3 event triggers');

app.synth();