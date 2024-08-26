import { ugPageActionsService } from '@services/pages/ugPageActionsService';
import { Request, Response } from 'express';

export const ugLogoutController = async (_req: Request, res: Response) => {
  const { success, message } = await ugPageActionsService({
    action: 'logout',
  });

  res.json({ success, message });
};
