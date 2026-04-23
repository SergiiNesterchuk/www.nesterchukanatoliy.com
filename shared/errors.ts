export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, identifier: string) {
    super(`${entity} not found: ${identifier}`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class IntegrationError extends AppError {
  constructor(integration: string, message: string, details?: Record<string, unknown>) {
    super(`[${integration}] ${message}`, "INTEGRATION_ERROR", 502, details);
    this.name = "IntegrationError";
  }
}

export class PaymentError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "PAYMENT_ERROR", 400, details);
    this.name = "PaymentError";
  }
}

export class WebhookVerificationError extends AppError {
  constructor(provider: string) {
    super(`Invalid webhook signature from ${provider}`, "WEBHOOK_VERIFICATION_ERROR", 401);
    this.name = "WebhookVerificationError";
  }
}

export class RetryableSyncError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "RETRYABLE_SYNC_ERROR", 503, details);
    this.name = "RetryableSyncError";
  }
}

export class FatalSyncError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "FATAL_SYNC_ERROR", 500, details);
    this.name = "FatalSyncError";
  }
}
