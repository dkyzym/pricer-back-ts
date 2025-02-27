export class BaseError extends Error {
  public success = false;
  public code: number;

  constructor(message = 'Unknown error') {
    super(message);
    this.code = 500;
  }
}

export class ValidationError extends BaseError {
  #errors: any;

  constructor(message = 'Validation error', errors: any = null) {
    super(message);

    this.code = 400;
    this.#errors = errors;
  }

  get errors() {
    return this.#errors;
  }
}

export class NotFoundError extends BaseError {
  constructor(message = 'Not found') {
    super(message);
    this.code = 404;
  }
}

export class RouteNotFoundError extends BaseError {
  constructor() {
    super('Route not found :) ');

    this.code = 404;
  }
}

export class ConflictError extends BaseError {
  constructor(message = 'Conflict') {
    super(message);

    this.code = 409;
  }
}

export class UnAuthorizedError extends BaseError {
  constructor(message = 'Unauthorized error') {
    super(message);
    this.code = 401;
  }
}

export class ForbiddenError extends BaseError {
  constructor(message = 'Forbidden error') {
    super(message);
    this.code = 403;
  }
}

export class NotLoggedInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotLoggedInError';
    Object.setPrototypeOf(this, NotLoggedInError.prototype);
  }
}
