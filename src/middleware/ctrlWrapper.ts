import { NextFunction, Request, RequestHandler, Response } from 'express';

export const ctrlWrapper = (ctrl: RequestHandler) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ctrl(req, res, next);
    } catch (error: unknown) {
      next(error as Error);
    }
  };
};
