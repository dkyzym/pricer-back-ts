import { patriotPageActionsService } from '@services/pages/patriotPageActionsService';
import { Request, Response } from 'express';

export const patriotLogoutController = async (_req: Request, res: Response) => {
  const { success, message } = await patriotPageActionsService({
    action: 'logout',
    supplier: 'patriot',
  });

  res.json({ success, message });
};
