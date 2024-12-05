import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAutocomplete } from '../../services/getAutocomplete';

export const autocompleteUgController = async (req: Request, res: Response) => {
  const term = req.query.term as string;

  if (!term) {
    return res
      .status(400)
      .json({ success: false, message: 'Term is required' });
  }
  const trimmedTerm = term.trim();

  const data = await getAutocomplete(trimmedTerm);

  const dataWithId = data.map((element: any) => ({
    id: uuidv4(),
    ...element,
  }));

  res.json({ success: true, results: dataWithId });
};
