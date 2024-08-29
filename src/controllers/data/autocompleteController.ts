import { Request, Response } from 'express';
import { ugPageActionsService } from 'services/pages/ugPageActionsService';

export const autocompleteController = async (req: Request, res: Response) => {
  const { query } = req.query as { query: string };

  const data = await ugPageActionsService({
    action: 'autocomplete',
    supplier: 'ug',
    query,
  });

  res.json(data);
};
