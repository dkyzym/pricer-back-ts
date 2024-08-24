import { Request, Response } from 'express';
import { orionPageActionsService } from '../../../services/pages/orionPageActionsService';

export const orionLoginController = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const { success, message } = await orionPageActionsService(
    username,
    password
  );

  res.json({ success, message });
};
