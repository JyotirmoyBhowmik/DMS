export interface ValidationErrorDetail {
  path: string;
  message: string;
}

export class ValidationError extends Error {
  public readonly code = 'VALIDATION_ERROR';
  public readonly details: ValidationErrorDetail[];

  constructor(message: string, details: ValidationErrorDetail[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
