import { orionPageActionsService } from '@services/pages/orionPageActionsService';
import { Request, Response } from 'express';

export const orionLogoutController = async (_req: Request, res: Response) => {
  const { success, message } = await orionPageActionsService({
    action: 'logout',
  });

  res.json({ success, message });
};
