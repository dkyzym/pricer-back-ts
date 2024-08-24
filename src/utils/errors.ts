export class BaseError extends Error {
  public success = false; // Было приватное свойство, стало публичное
  public code: number; // Изменили модификатор доступа на public

  constructor(message = 'Unknown error') {
    super(message);
    this.code = 500; // Устанавливаем код по умолчанию
  }
}

export class ValidationError extends BaseError {
  #errors: any; // Определяем тип для ошибок

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
    super('Route not found');

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
