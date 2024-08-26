import { tcPageActionsService } from '@services/pages/lugocarPageActionsService';
import { Request, Response } from 'express';

export const tcLogoutController = async (_req: Request, res: Response) => {
  const { success, message } = await tcPageActionsService({
    action: 'logout',
  });

  res.json({ success, message });
};
