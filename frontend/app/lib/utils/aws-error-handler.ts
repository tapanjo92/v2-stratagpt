import { signOut } from 'aws-amplify/auth';

export interface AWSErrorDetails {
  code?: string;
  message: string;
  statusCode?: number;
  retryable?: boolean;
}

export class AWSError extends Error {
  code?: string;
  statusCode?: number;
  retryable: boolean;

  constructor(details: AWSErrorDetails) {
    super(details.message);
    this.name = 'AWSError';
    this.code = details.code;
    this.statusCode = details.statusCode;
    this.retryable = details.retryable || false;
  }
}

export function isRetryableError(error: any): boolean {
  if (error.retryable === true) return true;
  
  const retryableCodes = [
    'ProvisionedThroughputExceededException',
    'ThrottlingException',
    'RequestLimitExceeded',
    'ServiceUnavailable',
    'RequestTimeout',
    'RequestTimeoutException',
    'NetworkingError'
  ];
  
  const retryableStatusCodes = [429, 500, 502, 503, 504];
  
  return (
    (error.code && retryableCodes.includes(error.code)) ||
    (error.statusCode && retryableStatusCodes.includes(error.statusCode)) ||
    (error.$metadata?.httpStatusCode && retryableStatusCodes.includes(error.$metadata.httpStatusCode))
  );
}

export function isAuthError(error: any): boolean {
  const authErrorCodes = [
    'UnauthorizedException',
    'AccessDeniedException',
    'TokenRefreshRequired',
    'InvalidUserPoolConfigurationException',
    'NotAuthorizedException',
    'UserNotFoundException',
    'PasswordResetRequiredException',
    'UserNotConfirmedException'
  ];
  
  const authStatusCodes = [401, 403];
  
  return (
    (error.code && authErrorCodes.includes(error.code)) ||
    (error.statusCode && authStatusCodes.includes(error.statusCode)) ||
    (error.$metadata?.httpStatusCode && authStatusCodes.includes(error.$metadata.httpStatusCode)) ||
    (error.message && error.message.toLowerCase().includes('unauthorized'))
  );
}

export async function handleAWSError(error: any): Promise<void> {
  console.error('AWS Error:', error);
  
  if (isAuthError(error)) {
    try {
      await signOut();
    } catch (signOutError) {
      console.error('Error signing out:', signOutError);
    }
    throw new AWSError({
      code: error.code,
      message: 'Authentication error. Please sign in again.',
      statusCode: error.statusCode || error.$metadata?.httpStatusCode,
      retryable: false
    });
  }
  
  if (isRetryableError(error)) {
    throw new AWSError({
      code: error.code,
      message: error.message || 'A temporary error occurred. Please try again.',
      statusCode: error.statusCode || error.$metadata?.httpStatusCode,
      retryable: true
    });
  }
  
  throw new AWSError({
    code: error.code,
    message: error.message || 'An unexpected error occurred.',
    statusCode: error.statusCode || error.$metadata?.httpStatusCode,
    retryable: false
  });
}

export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const defaultRetryConfig: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxAttempts, initialDelay, maxDelay, backoffMultiplier } = {
    ...defaultRetryConfig,
    ...config
  };
  
  let lastError: any;
  let delay = initialDelay;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !isRetryableError(error)) {
        await handleAWSError(error);
      }
      
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }
  
  await handleAWSError(lastError);
  throw lastError;
}

export function createExponentialBackoff(config: RetryConfig = {}): (attempt: number) => number {
  const { initialDelay, maxDelay, backoffMultiplier } = {
    ...defaultRetryConfig,
    ...config
  };
  
  return (attempt: number): number => {
    const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
    const jitter = delay * 0.1 * Math.random();
    return Math.min(delay + jitter, maxDelay);
  };
}

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenRequests?: number;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private halfOpenAttempts = 0;
  
  constructor(
    private config: Required<CircuitBreakerConfig> = {
      failureThreshold: 5,
      resetTimeout: 60000,
      halfOpenRequests: 3
    }
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure > this.config.resetTimeout) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
      } else {
        throw new AWSError({
          message: 'Circuit breaker is open. Service temporarily unavailable.',
          retryable: true
        });
      }
    }
    
    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.halfOpenAttempts++;
        if (this.halfOpenAttempts >= this.config.halfOpenRequests) {
          this.state = 'closed';
          this.failures = 0;
        }
      } else if (this.state === 'closed') {
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.config.failureThreshold) {
        this.state = 'open';
      }
      
      throw error;
    }
  }
  
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
  
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.halfOpenAttempts = 0;
  }
}