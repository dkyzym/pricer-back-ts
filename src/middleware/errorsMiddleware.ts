import chalk from 'chalk';
import { NextFunction, Request, Response } from 'express';
import { BaseError } from '../utils/errors';

export const error = (
  error: BaseError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  console.log(chalk.red.italic(`${error.stack}`));

  if (error instanceof BaseError) {
    const { code, success, message } = error;
    const data: { success: boolean; message: string; errors?: any } = {
      success,
      message,
    };

    return res.status(code).json(data);
  }

  return res
    .status(500)
    .json({ success: false, message: 'Internal server error' });
};
