import { Request, Response } from 'express';
import { ugPageActionsService } from 'services/pages/ugPageActionsService';
import { checkEmptyField } from 'utils/data/validationHelpers';

export const autocompleteController = async (req: Request, res: Response) => {
  const { query } = req.query as { query: string };

  checkEmptyField(query, 'Empty search field');

  await ugPageActionsService({ action: 'autocomplete', supplier: 'ug', query });

  console.log(query);

  res.json(query);
};
