StrataGPT - Test-Driven Phase Implementation Plan

  Document Version: v3.0Last Updated: 17 June 2025Status: TEST-DRIVEN ARCHITECTURE

  ---
  🎯 Implementation Philosophy

  Core Principle: Each subphase must pass integration tests with all previous functionality before proceeding. No phase is complete until all
  regression tests pass.

  Test Pyramid:
  - Unit Tests: Individual component functionality
  - Integration Tests: Cross-component interactions
  - E2E Tests: Full user journey validation
  - Regression Suite: All previous phase tests

  ---
  📅 Phase 1: Foundation & Identity Infrastructure

  Subphase 1.1: AWS Account & CDK Setup

  Duration: 2 days

  Tasks

  - Initialize CDK project with TypeScript
  - Create base stack structure
  - Set up environment configurations
  - Configure AWS CLI profiles

  Tests Required

  // Test Suite: Foundation
  describe('Foundation Infrastructure', () => {
    test('CDK synthesizes without errors', async () => {
      const app = new cdk.App()
      const stack = new BaseStack(app, 'test')
      expect(() => app.synth()).not.toThrow()
    })

    test('Environment variables are properly set', () => {
      expect(process.env.AWS_REGION).toBeDefined()
      expect(process.env.STAGE).toBeDefined()
    })
  })

  ✅ Gate: Can synthesize and deploy empty stack

  ---
  Subphase 1.2: Cognito User Pool Setup

  Duration: 3 days

  Tasks

  - Create Cognito User Pool with MFA
  - Configure password policies
  - Set up custom attributes
  - Create test users programmatically

  Tests Required

  // Test Suite: Authentication Base
  describe('Cognito User Pool', () => {
    test('User Pool exists and is configured correctly', async () => {
      const cognito = new CognitoIdentityProviderClient({})
      const response = await cognito.send(new DescribeUserPoolCommand({
        UserPoolId: process.env.USER_POOL_ID
      }))

      expect(response.UserPool?.MfaConfiguration).toBe('ON')
      expect(response.UserPool?.Policies?.PasswordPolicy?.MinimumLength).toBe(12)
    })

    test('Can create and authenticate test user', async () => {
      const testUser = await createTestUser()
      const tokens = await authenticateUser(testUser.username, testUser.password)
      expect(tokens.IdToken).toBeDefined()
    })
  })

  ✅ Gate: Can create user and get JWT token

  ---
  Subphase 1.3: Cognito Identity Pool Integration

  Duration: 3 days

  Tasks

  - Create Identity Pool linked to User Pool
  - Configure authenticated/unauthenticated roles
  - Create fine-grained IAM policies
  - Test credential vending

  Tests Required

  // Test Suite: Identity Pool
  describe('Identity Pool Integration', () => {
    let credentials: AWS.Credentials

    beforeAll(async () => {
      const tokens = await authenticateTestUser()
      credentials = await getIdentityPoolCredentials(tokens.IdToken)
    })

    test('Can obtain temporary AWS credentials', () => {
      expect(credentials.accessKeyId).toBeDefined()
      expect(credentials.secretAccessKey).toBeDefined()
      expect(credentials.sessionToken).toBeDefined()
    })

    test('Credentials have correct permissions', async () => {
      const sts = new STSClient({ credentials })
      const identity = await sts.send(new GetCallerIdentityCommand({}))
      expect(identity.Arn).toContain('assumed-role/StrataGPT-AuthenticatedRole')
    })

    test('Integration: User Pool + Identity Pool flow', async () => {
      // Full flow test
      const signUpResult = await signUp('test@example.com', 'TestPass123!')
      const confirmResult = await confirmSignUp(signUpResult.username, '123456')
      const signInResult = await signIn('test@example.com', 'TestPass123!')
      const credentials = await getCredentials(signInResult.idToken)

      expect(credentials).toBeDefined()
    })
  })

  // Regression: All Phase 1.1 and 1.2 tests must still pass

  ✅ Gate: Frontend can obtain AWS credentials via auth flow

  ---
  Subphase 1.4: DynamoDB Direct Access Setup

  Duration: 2 days

  Tasks

  - Create DynamoDB table with proper indexes
  - Configure IAM policies for Identity Pool
  - Implement user data isolation pattern
  - Create test data fixtures

  Tests Required

  // Test Suite: Direct DynamoDB Access
  describe('DynamoDB Direct Access', () => {
    let ddbClient: DynamoDBClient
    let identityId: string

    beforeAll(async () => {
      const creds = await getAuthenticatedCredentials()
      identityId = creds.identityId
      ddbClient = new DynamoDBClient({ credentials: creds })
    })

    test('Can write to own partition', async () => {
      const command = new PutItemCommand({
        TableName: 'StrataGPT',
        Item: {
          PK: { S: `USER#${identityId}` },
          SK: { S: `PROFILE#${Date.now()}` },
          data: { S: 'test data' }
        }
      })

      await expect(ddbClient.send(command)).resolves.not.toThrow()
    })

    test('Cannot access other user partitions', async () => {
      const command = new GetItemCommand({
        TableName: 'StrataGPT',
        Key: {
          PK: { S: 'USER#different-user-id' },
          SK: { S: 'PROFILE#123' }
        }
      })

      await expect(ddbClient.send(command)).rejects.toThrow(/AccessDenied/)
    })

    test('Integration: Full auth to database flow', async () => {
      // Sign in → Get credentials → Write to DDB → Read from DDB
      const flow = await testFullUserFlow()
      expect(flow.every(step => step.success)).toBe(true)
    })
  })

  // Regression: All previous tests must pass

  ✅ Gate: Authenticated users can read/write their own data only

  ---
  📅 Phase 2: Core Application Shell

  Subphase 2.1: Next.js Application Setup

  Duration: 2 days

  Tasks

  - Initialize Next.js 14 with App Router
  - Configure AWS Amplify Gen2
  - Set up environment variables
  - Create base layout

  Tests Required

  // Test Suite: Frontend Foundation
  describe('Next.js Application', () => {
    test('Application builds successfully', async () => {
      const buildProcess = exec('npm run build')
      expect(buildProcess.exitCode).toBe(0)
    })

    test('Environment variables are loaded', () => {
      expect(process.env.NEXT_PUBLIC_USER_POOL_ID).toBeDefined()
      expect(process.env.NEXT_PUBLIC_IDENTITY_POOL_ID).toBeDefined()
    })

    test('Can render home page', async () => {
      const response = await fetch('http://localhost:3000')
      expect(response.status).toBe(200)
    })
  })

  ✅ Gate: Next.js app builds and serves

  ---
  Subphase 2.2: Authentication UI Implementation

  Duration: 3 days

  Tasks

  - Create sign up/sign in pages
  - Implement MFA setup flow
  - Add password reset functionality
  - Create auth context with Amplify

  Tests Required

  // Test Suite: Authentication UI
  describe('Authentication UI', () => {
    test('Sign up flow completes successfully', async () => {
      const { getByLabelText, getByText } = render(<SignUpPage />)

      fireEvent.change(getByLabelText('Email'), {
        target: { value: 'test@example.com' }
      })
      fireEvent.change(getByLabelText('Password'), {
        target: { value: 'TestPass123!' }
      })
      fireEvent.click(getByText('Sign Up'))

      await waitFor(() => {
        expect(getByText('Confirm your email')).toBeInTheDocument()
      })
    })

    test('Integration: Sign up → Confirm → Sign in', async () => {
      const user = await createTestUser()
      const page = await browser.newPage()

      // Full E2E flow
      await page.goto('http://localhost:3000/signup')
      await page.fill('[name="email"]', user.email)
      await page.fill('[name="password"]', user.password)
      await page.click('button[type="submit"]')

      // Confirm email
      await page.fill('[name="code"]', '123456')
      await page.click('button[type="submit"]')

      // Should redirect to dashboard
      await page.waitForURL('**/dashboard')
      expect(page.url()).toContain('/dashboard')
    })

    test('Obtains Identity Pool credentials after sign in', async () => {
      const { credentials } = await signInAndGetCredentials()
      expect(credentials.accessKeyId).toBeDefined()
    })
  })

  // Regression: All Phase 1 tests must pass

  ✅ Gate: Users can complete full auth flow and get AWS credentials

  ---
  Subphase 2.3: AWS SDK Integration in Frontend

  Duration: 2 days

  Tasks

  - Configure AWS SDK v3 with credentials
  - Create service clients (S3, DynamoDB)
  - Implement credential refresh logic
  - Add error handling

  Tests Required

  // Test Suite: AWS SDK Integration
  describe('Frontend AWS SDK', () => {
    test('DynamoDB client initialized with user credentials', async () => {
      const { ddbClient } = await getAuthenticatedClients()

      const command = new ListTablesCommand({})
      const response = await ddbClient.send(command)

      expect(response.TableNames).toContain('StrataGPT')
    })

    test('S3 client can list user prefix', async () => {
      const { s3Client, identityId } = await getAuthenticatedClients()

      const command = new ListObjectsV2Command({
        Bucket: 'strata-documents',
        Prefix: `users/${identityId}/`
      })

      await expect(s3Client.send(command)).resolves.not.toThrow()
    })

    test('Credentials auto-refresh before expiry', async () => {
      const provider = await getCredentialProvider()
      const creds1 = await provider()

      // Fast forward time
      jest.advanceTimersByTime(50 * 60 * 1000) // 50 minutes

      const creds2 = await provider()
      expect(creds2.accessKeyId).not.toBe(creds1.accessKeyId)
    })
  })

  ✅ Gate: Frontend can make authenticated AWS API calls

  ---
  📅 Phase 3: Document Management System

  Subphase 3.1: Direct S3 Upload Implementation

  Duration: 3 days

  Tasks

  - Create file upload component
  - Implement multipart upload
  - Add progress tracking
  - Create file metadata system

  Tests Required

  // Test Suite: S3 Direct Upload
  describe('S3 Direct Upload', () => {
    test('Can upload file to user partition', async () => {
      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf'
      })

      const uploader = new S3Uploader()
      const result = await uploader.upload(file)

      expect(result.key).toMatch(/users\/.*\/documents\/test\.pdf/)
      expect(result.etag).toBeDefined()
    })

    test('Upload progress is tracked', async () => {
      const file = createLargeTestFile(10 * 1024 * 1024) // 10MB
      const progress: number[] = []

      const uploader = new S3Uploader()
      uploader.on('progress', (p) => progress.push(p))

      await uploader.upload(file)

      expect(progress.length).toBeGreaterThan(5)
      expect(progress[progress.length - 1]).toBe(100)
    })

    test('Cannot upload to other user paths', async () => {
      const uploader = new S3Uploader()

      await expect(
        uploader.uploadToPath('users/other-user/documents/file.pdf')
      ).rejects.toThrow(/Access Denied/)
    })

    test('Integration: Upload → List → Download', async () => {
      const file = createTestFile()

      // Upload
      const uploadResult = await uploader.upload(file)

      // List
      const files = await uploader.listFiles()
      expect(files).toContainEqual(
        expect.objectContaining({ key: uploadResult.key })
      )

      // Download
      const downloaded = await uploader.download(uploadResult.key)
      expect(downloaded.size).toBe(file.size)
    })
  })

  // Regression: All previous tests

  ✅ Gate: Users can upload files directly to S3

  ---
  Subphase 3.2: Document Processing Pipeline

  Duration: 4 days

  Tasks

  - Create S3 event triggers
  - Implement Lambda for text extraction
  - Add document metadata to DynamoDB
  - Create processing status tracking

  Tests Required

  // Test Suite: Document Processing
  describe('Document Processing Pipeline', () => {
    test('S3 upload triggers processing', async () => {
      const file = createTestPDF()
      const uploadResult = await uploader.upload(file)

      // Wait for processing
      await waitFor(async () => {
        const status = await getProcessingStatus(uploadResult.key)
        expect(status).toBe('completed')
      }, { timeout: 30000 })
    })

    test('Extracted text stored in DynamoDB', async () => {
      const { key } = await uploadAndProcess(testPDF)

      const metadata = await ddbClient.send(new GetItemCommand({
        TableName: 'StrataGPT',
        Key: {
          PK: { S: `USER#${identityId}` },
          SK: { S: `DOC#${key}` }
        }
      }))

      expect(metadata.Item.extractedText).toBeDefined()
      expect(metadata.Item.pageCount.N).toBe('5')
    })

    test('Failed processing is handled', async () => {
      const corruptFile = createCorruptPDF()
      const { key } = await uploader.upload(corruptFile)

      await waitFor(async () => {
        const status = await getProcessingStatus(key)
        expect(status).toBe('failed')
      })

      const error = await getProcessingError(key)
      expect(error).toContain('Invalid PDF')
    })

    test('Integration: Full document lifecycle', async () => {
      // Upload → Process → Index → Search
      const doc = await uploadDocument('test-strata-law.pdf')
      await waitForProcessing(doc.key)

      const searchResults = await searchDocuments('strata law')
      expect(searchResults).toContainEqual(
        expect.objectContaining({ documentKey: doc.key })
      )
    })
  })

  // Regression: All previous tests including auth and S3

  ✅ Gate: Documents are processed and searchable

  ---
  📅 Phase 4: Chat Interface with Direct Access

  Subphase 4.1: Chat UI Components

  Duration: 3 days

  Tasks

  - Create chat interface layout
  - Implement message components
  - Add typing indicators
  - Create message history view

  Tests Required

  // Test Suite: Chat UI
  describe('Chat Interface', () => {
    test('Can send and display messages', async () => {
      const { getByPlaceholder, getByText } = render(<ChatInterface />)

      const input = getByPlaceholder('Type your message...')
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.submit(input.closest('form'))

      await waitFor(() => {
        expect(getByText('Test message')).toBeInTheDocument()
      })
    })

    test('Messages persist in DynamoDB', async () => {
      const message = 'Test persistence'
      await sendMessage(message)

      const messages = await ddbClient.send(new QueryCommand({
        TableName: 'StrataGPT',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': { S: `USER#${identityId}` },
          ':sk': { S: 'CHAT#' }
        }
      }))

      expect(messages.Items).toContainEqual(
        expect.objectContaining({
          message: { S: message }
        })
      )
    })
  })

  ✅ Gate: Chat messages are stored and retrieved

  ---
  Subphase 4.2: OpenSearch Direct Query Integration

  Duration: 4 days

  Tasks

  - Configure OpenSearch client with credentials
  - Implement vector search
  - Add query builder
  - Create result ranking

  Tests Required

  // Test Suite: OpenSearch Integration
  describe('OpenSearch Direct Access', () => {
    test('Can perform vector search', async () => {
      const query = 'strata committee powers'
      const results = await searchClient.search({
        index: 'strata-docs',
        body: {
          query: {
            knn: {
              embedding: {
                vector: await getEmbedding(query),
                k: 5
              }
            }
          }
        }
      })

      expect(results.hits.hits.length).toBeGreaterThan(0)
      expect(results.hits.hits[0]._score).toBeGreaterThan(0.7)
    })

    test('Search respects user permissions', async () => {
      // User can only search their tenant's documents
      const results = await searchClient.search({
        index: 'strata-docs',
        body: {
          query: {
            bool: {
              must: [
                { match: { tenantId: 'other-tenant' } }
              ]
            }
          }
        }
      })

      expect(results.hits.hits.length).toBe(0)
    })

    test('Integration: Upload → Process → Search → Display', async () => {
      // Complete document to search result flow
      const doc = await uploadDocument('committee-powers.pdf')
      await waitForProcessing(doc.key)
      await waitForIndexing(doc.key)

      const results = await searchDocuments('committee voting')
      expect(results[0].documentKey).toBe(doc.key)

      const chatResponse = await sendChatMessage('What are committee voting powers?')
      expect(chatResponse).toContain('committee')
      expect(chatResponse.citations).toContainEqual(
        expect.arrayContaining([doc.key])
      )
    })
  })

  // Regression: All previous tests

  ✅ Gate: RAG system works end-to-end

  ---
  Subphase 4.3: AI Response Generation

  Duration: 3 days

  Tasks

  - Integrate OpenAI API
  - Create prompt templates
  - Implement response streaming
  - Add citation system

  Tests Required

  // Test Suite: AI Integration
  describe('AI Response Generation', () => {
    test('Generates contextual responses', async () => {
      const context = [
        { text: 'Committee must have 3 members', source: 'doc1' },
        { text: 'Quorum is majority of committee', source: 'doc2' }
      ]

      const response = await generateAIResponse(
        'How many committee members for quorum?',
        context
      )

      expect(response.answer).toContain('majority')
      expect(response.answer).toContain('3 members')
      expect(response.citations).toEqual(['doc1', 'doc2'])
    })

    test('Handles streaming responses', async () => {
      const chunks: string[] = []
      const stream = await generateStreamingResponse('test query')

      for await (const chunk of stream) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThan(5)
      expect(chunks.join('')).toContain('committee')
    })

    test('Integration: Complete chat flow', async () => {
      // User asks question → Search → AI → Response with citations
      const { getByPlaceholder, getByTestId } = render(<ChatInterface />)

      const input = getByPlaceholder('Ask about strata law...')
      fireEvent.change(input, {
        target: { value: 'What are my rights as an owner?' }
      })
      fireEvent.submit(input.closest('form'))

      await waitFor(() => {
        const response = getByTestId('ai-response')
        expect(response).toHaveTextContent(/rights/)

        const citations = getByTestId('citations')
        expect(citations.children.length).toBeGreaterThan(0)
      }, { timeout: 10000 })
    })
  })

  // Regression: All previous tests

  ✅ Gate: Full RAG chat system functional

  ---
  📅 Phase 5: Billing & Subscription Management

  Subphase 5.1: Stripe Direct Integration

  Duration: 3 days

  Tasks

  - Configure Stripe.js
  - Create payment element
  - Implement subscription flow
  - Add webhook handler

  Tests Required

  // Test Suite: Payment Integration
  describe('Stripe Payments', () => {
    test('Can create payment intent', async () => {
      const stripe = await loadStripe(STRIPE_PK)
      const { clientSecret } = await createPaymentIntent(1000)

      expect(clientSecret).toMatch(/^pi_.*_secret_.*/)
    })

    test('Subscription status syncs to DynamoDB', async () => {
      // Simulate Stripe webhook
      await simulateWebhook('customer.subscription.created', {
        customer: 'cus_123',
        status: 'active',
        current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000
      })

      const subscription = await getSubscriptionStatus(userId)
      expect(subscription.status).toBe('active')
      expect(subscription.validUntil).toBeGreaterThan(Date.now())
    })

    test('Integration: Purchase → Access granted', async () => {
      // Complete payment flow
      await completePayment(testCard)

      // Verify subscription active
      const sub = await getSubscriptionStatus()
      expect(sub.status).toBe('active')

      // Verify can access premium features
      const premiumDoc = await accessPremiumDocument()
      expect(premiumDoc).toBeDefined()
    })
  })

  // Regression: Ensure free users still have limited access

  ✅ Gate: Payment system fully integrated

  ---
  📅 Phase 6: Production Readiness

  Subphase 6.1: Security Hardening

  Duration: 4 days

  Tasks

  - Implement CSP headers
  - Add rate limiting
  - Configure WAF rules
  - Enable audit logging

  Tests Required

  // Test Suite: Security
  describe('Security Measures', () => {
    test('CSP headers prevent XSS', async () => {
      const response = await fetch('https://app.stratagpt.com')
      const csp = response.headers.get('content-security-policy')

      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("script-src 'self' 'unsafe-inline'")
    })

    test('Rate limiting enforced', async () => {
      const requests = Array(100).fill(null).map(() =>
        searchDocuments('test')
      )

      const results = await Promise.allSettled(requests)
      const rejected = results.filter(r => r.status === 'rejected')

      expect(rejected.length).toBeGreaterThan(50)
    })

    test('Audit logs capture all actions', async () => {
      const action = await performAuditableAction()

      const logs = await cloudwatchClient.send(new GetLogEventsCommand({
        logGroupName: '/aws/lambda/audit',
        startTime: Date.now() - 60000
      }))

      expect(logs.events).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(action.id)
        })
      )
    })
  })

  // Regression: All features still work with security enabled

  ✅ Gate: Security measures don't break functionality

  ---
  Subphase 6.2: Performance Optimization

  Duration: 3 days

  Tasks

  - Implement caching strategies
  - Optimize bundle size
  - Add CDN distribution
  - Configure auto-scaling

  Tests Required

  // Test Suite: Performance
  describe('Performance Benchmarks', () => {
    test('Page load time under 3s', async () => {
      const metrics = await lighthouse('https://app.stratagpt.com')
      expect(metrics.performance).toBeGreaterThan(90)
    })

    test('API responses under 200ms', async () => {
      const times = await measureApiLatency(100)
      const p95 = percentile(times, 95)

      expect(p95).toBeLessThan(200)
    })

    test('Handles concurrent users', async () => {
      const results = await loadTest({
        concurrent: 1000,
        duration: '5m',
        scenario: 'chat-interaction'
      })

      expect(results.errorRate).toBeLessThan(0.01)
      expect(results.p99).toBeLessThan(1000)
    })
  })

  // Full regression suite: All previous functionality

  ✅ Gate: Performance meets SLA requirements

  ---
  Subphase 6.3: Monitoring & Observability

  Duration: 2 days

  Tasks

  - Set up CloudWatch dashboards
  - Configure alerts
  - Implement distributed tracing
  - Add business metrics

  Tests Required

  // Test Suite: Monitoring
  describe('Observability', () => {
    test('All errors are captured', async () => {
      await triggerTestError()

      const alarm = await waitForAlarm('ErrorRateHigh')
      expect(alarm.state).toBe('ALARM')
    })

    test('Tracing captures full request path', async () => {
      const traceId = await performTracedOperation()

      const trace = await xrayClient.send(new GetTraceCommand({
        traceId
      }))

      expect(trace.segments.length).toBeGreaterThan(5)
      expect(trace.segments).toContainEqual(
        expect.objectContaining({ name: 'DynamoDB' })
      )
    })

    test('Business metrics tracked', async () => {
      const metrics = await getBusinessMetrics()

      expect(metrics).toMatchObject({
        dailyActiveUsers: expect.any(Number),
        questionsAsked: expect.any(Number),
        documentsProcessed: expect.any(Number),
        subscriptionRevenue: expect.any(Number)
      })
    })
  })

  // Final regression: Everything still works

  ✅ Gate: Full system observability achieved

  ---
  📋 Test Execution Strategy

  Continuous Testing

  # GitHub Actions Workflow
  name: Test Pipeline

  on: [push, pull_request]

  jobs:
    test:
      runs-on: ubuntu-latest
      strategy:
        matrix:
          phase: [1, 2, 3, 4, 5, 6]

      steps:
        - name: Run Phase ${{ matrix.phase }} Tests
          run: |
            npm run test:phase${{ matrix.phase }}
            npm run test:regression:phase${{ matrix.phase }}

        - name: E2E Tests
          if: matrix.phase >= 3
          run: npm run test:e2e:phase${{ matrix.phase }}

  Test Data Management

  // Test data lifecycle
  class TestDataManager {
    async setupPhase(phase: number) {
      await this.cleanPreviousTestData()
      await this.createTestUsers(phase)
      await this.seedTestDocuments(phase)
      await this.configureTestSubscriptions(phase)
    }

    async teardownPhase(phase: number) {
      await this.archiveTestResults(phase)
      await this.cleanTestData(phase)
    }
  }

  Rollback Strategy

  // Automatic rollback on test failure
  class PhaseDeployment {
    async deployPhase(phase: number, subphase: string) {
      const snapshot = await this.createSnapshot()

      try {
        await this.deploy(phase, subphase)
        const testResults = await this.runTests(phase, subphase)

        if (!testResults.passed) {
          await this.rollback(snapshot)
          throw new Error(`Phase ${phase}.${subphase} tests failed`)
        }
      } catch (error) {
        await this.rollback(snapshot)
        throw error
      }
    }
  }

  🎯 Success Criteria

  Each phase is complete only when:
  1. All subphase tests pass: 100% success rate
  2. All regression tests pass: Previous functionality intact
  3. Performance benchmarks met: No degradation
  4. Security scans pass: No new vulnerabilities
  5. Documentation updated: API docs, runbooks current

  This test-driven approach ensures that each piece of functionality is verified before moving forward, preventing the accumulation of technical
   debt and ensuring a stable, working system at every stage.

