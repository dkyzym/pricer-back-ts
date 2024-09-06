import { turboCarsPageActionsService } from '@services/pages/turboCarsPageActionsService';
import { Request, Response } from 'express';

export const tcLoginController = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const { success, message } = await turboCarsPageActionsService({
    action: 'login',
    username,
    password,
    supplier: 'turboCars',
  });

  res.json({ success, message });
};
