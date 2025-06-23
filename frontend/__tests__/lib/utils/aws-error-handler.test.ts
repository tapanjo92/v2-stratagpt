import { 
  isRetryableError, 
  isAuthError, 
  handleAWSError, 
  withRetry,
  createExponentialBackoff,
  CircuitBreaker,
  AWSError
} from '@/app/lib/utils/aws-error-handler';
import { signOut } from 'aws-amplify/auth';

jest.mock('aws-amplify/auth');

describe('AWS Error Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors by code', () => {
      const retryableErrors = [
        { code: 'ThrottlingException' },
        { code: 'RequestLimitExceeded' },
        { code: 'ServiceUnavailable' }
      ];

      retryableErrors.forEach(error => {
        expect(isRetryableError(error)).toBe(true);
      });
    });

    it('should identify retryable errors by status code', () => {
      const retryableErrors = [
        { statusCode: 429 },
        { statusCode: 500 },
        { statusCode: 503 },
        { $metadata: { httpStatusCode: 502 } }
      ];

      retryableErrors.forEach(error => {
        expect(isRetryableError(error)).toBe(true);
      });
    });

    it('should identify non-retryable errors', () => {
      const nonRetryableErrors = [
        { code: 'ValidationException' },
        { statusCode: 400 },
        { statusCode: 404 }
      ];

      nonRetryableErrors.forEach(error => {
        expect(isRetryableError(error)).toBe(false);
      });
    });

    it('should handle errors with retryable flag', () => {
      expect(isRetryableError({ retryable: true })).toBe(true);
      expect(isRetryableError({ retryable: false })).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('should identify auth errors by code', () => {
      const authErrors = [
        { code: 'UnauthorizedException' },
        { code: 'AccessDeniedException' },
        { code: 'NotAuthorizedException' }
      ];

      authErrors.forEach(error => {
        expect(isAuthError(error)).toBe(true);
      });
    });

    it('should identify auth errors by status code', () => {
      const authErrors = [
        { statusCode: 401 },
        { statusCode: 403 },
        { $metadata: { httpStatusCode: 401 } }
      ];

      authErrors.forEach(error => {
        expect(isAuthError(error)).toBe(true);
      });
    });

    it('should identify auth errors by message', () => {
      expect(isAuthError({ message: 'Unauthorized access' })).toBe(true);
      expect(isAuthError({ message: 'Request is UNAUTHORIZED' })).toBe(true);
    });
  });

  describe('handleAWSError', () => {
    it('should sign out and throw auth error for authentication errors', async () => {
      const authError = { code: 'UnauthorizedException', message: 'Auth failed' };

      await expect(handleAWSError(authError)).rejects.toThrow(AWSError);
      
      try {
        await handleAWSError(authError);
      } catch (error) {
        expect(error).toBeInstanceOf(AWSError);
        expect((error as AWSError).message).toBe('Authentication error. Please sign in again.');
        expect((error as AWSError).retryable).toBe(false);
      }

      expect(signOut).toHaveBeenCalled();
    });

    it('should throw retryable error for retryable errors', async () => {
      const retryableError = { 
        code: 'ThrottlingException', 
        message: 'Too many requests',
        statusCode: 429 
      };

      try {
        await handleAWSError(retryableError);
      } catch (error) {
        expect(error).toBeInstanceOf(AWSError);
        expect((error as AWSError).retryable).toBe(true);
        expect((error as AWSError).code).toBe('ThrottlingException');
      }
    });

    it('should throw non-retryable error for other errors', async () => {
      const genericError = { 
        code: 'ValidationException', 
        message: 'Invalid input' 
      };

      try {
        await handleAWSError(genericError);
      } catch (error) {
        expect(error).toBeInstanceOf(AWSError);
        expect((error as AWSError).retryable).toBe(false);
      }
    });
  });

  describe('withRetry', () => {
    it('should retry operation on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce({ code: 'ThrottlingException' })
        .mockRejectedValueOnce({ code: 'ThrottlingException' })
        .mockResolvedValueOnce('success');

      const result = await withRetry(operation, { 
        maxAttempts: 3, 
        initialDelay: 10 
      });

      expect(operation).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce({ code: 'ValidationException', message: 'Bad input' });

      await expect(withRetry(operation, { maxAttempts: 3 }))
        .rejects.toThrow(AWSError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect max attempts', async () => {
      const operation = jest.fn()
        .mockRejectedValue({ code: 'ThrottlingException' });

      await expect(withRetry(operation, { 
        maxAttempts: 2, 
        initialDelay: 10 
      })).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle auth errors and sign out', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce({ code: 'UnauthorizedException' });

      await expect(withRetry(operation)).rejects.toThrow(AWSError);
      expect(signOut).toHaveBeenCalled();
    });
  });

  describe('createExponentialBackoff', () => {
    it('should calculate exponential backoff delays', () => {
      const backoff = createExponentialBackoff({
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2
      });

      const delay1 = backoff(1);
      const delay2 = backoff(2);
      const delay3 = backoff(3);

      expect(delay1).toBeGreaterThanOrEqual(100);
      expect(delay1).toBeLessThan(200);
      
      expect(delay2).toBeGreaterThanOrEqual(200);
      expect(delay2).toBeLessThan(400);
      
      expect(delay3).toBeGreaterThanOrEqual(400);
      expect(delay3).toBeLessThanOrEqual(1000);
    });

    it('should respect max delay', () => {
      const backoff = createExponentialBackoff({
        initialDelay: 100,
        maxDelay: 500,
        backoffMultiplier: 10
      });

      const delay = backoff(5);
      expect(delay).toBeLessThanOrEqual(500);
    });
  });

  describe('CircuitBreaker', () => {
    it('should execute operations when closed', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const operation = jest.fn().mockResolvedValue('success');

      const result = await breaker.execute(operation);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
    });

    it('should open after failure threshold', async () => {
      const breaker = new CircuitBreaker({ 
        failureThreshold: 2,
        resetTimeout: 100 
      });
      
      const operation = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();

      expect(breaker.getState()).toBe('open');
      
      await expect(breaker.execute(operation)).rejects.toThrow(AWSError);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should transition to half-open after reset timeout', async () => {
      const breaker = new CircuitBreaker({ 
        failureThreshold: 1,
        resetTimeout: 100,
        halfOpenRequests: 2
      });
      
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      await expect(breaker.execute(operation)).rejects.toThrow();
      expect(breaker.getState()).toBe('open');

      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await breaker.execute(operation);
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('half-open');

      await breaker.execute(operation);
      expect(breaker.getState()).toBe('closed');
    });

    it('should reset state', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });
      const operation = jest.fn().mockRejectedValue(new Error('fail'));

      breaker.execute(operation).catch(() => {});
      expect(breaker.getState()).not.toBe('closed');

      breaker.reset();
      expect(breaker.getState()).toBe('closed');
    });
  });
});