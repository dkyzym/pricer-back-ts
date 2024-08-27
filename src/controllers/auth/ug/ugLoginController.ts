import { ugPageActionsService } from '@services/pages/ugPageActionsService';
import { Request, Response } from 'express';

export const ugLoginController = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const { success, message } = await ugPageActionsService({
    action: 'login',
    username,
    password,
    supplier: 'ug',
  });

  res.json({ success, message });
};
