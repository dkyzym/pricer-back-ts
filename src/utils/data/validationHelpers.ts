import { ValidationError } from '../errors.js';

export const checkEmptyField = (query: string, errorMessage: string) => {
  if (!query.trim()) {
    throw new ValidationError(errorMessage);
  }
};
