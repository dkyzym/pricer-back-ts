import { orionPageActionsService } from '@services/pages/orionPageActionsService';
import { Request, Response } from 'express';

export const orionLoginController = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const { success, message } = await orionPageActionsService({
    action: 'login',
    username,
    password,
  });

  res.json({ success, message });
};
