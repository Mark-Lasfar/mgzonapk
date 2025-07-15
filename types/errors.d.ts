export class UnauthorizedError extends Error {
    constructor(message?: string) {
      super(message || 'Unauthorized access');
      this.name = 'UnauthorizedError';
    }
  }
  
  export class ForbiddenError extends Error {
    constructor(message?: string) {
      super(message || 'Forbidden access');
      this.name = 'ForbiddenError';
    }
  }