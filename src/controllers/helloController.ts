import { Request, Response } from 'express';

export const helloController = async (_req: Request, res: Response) => {
  res.status(200).send('Здравствуйте! Сервер pricer все еще работает.');
};
