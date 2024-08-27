import { tcPageActionsService } from '@services/pages/lugocarPageActionsService';
import { Request, Response } from 'express';

export const tcLogoutController = async (_req: Request, res: Response) => {
  const { success, message } = await tcPageActionsService({
    action: 'logout',
    supplier: 'turboCars',
  });

  res.json({ success, message });
};
