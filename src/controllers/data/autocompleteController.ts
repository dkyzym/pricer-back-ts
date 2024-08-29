import { Request, Response } from 'express';
import { ugPageActionsService } from 'services/pages/ugPageActionsService';

export const autocompleteController = async (req: Request, res: Response) => {
  const { query } = req.query as { query: string };

  await ugPageActionsService({ action: 'autocomplete', supplier: 'ug', query });

  console.log(query);

  res.json(query);
};
