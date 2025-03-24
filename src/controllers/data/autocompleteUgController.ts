import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAutocomplete } from '../../services/getAutocomplete.js';
import { ItemAutocompleteRow } from '../../types/index.js';

export const autocompleteUgController = async (req: Request, res: Response) => {
  const term = req.query.term as string;
  console.log(`term in autocompleteController: ${term}`);
  if (!term) {
    return res
      .status(400)
      .json({ success: false, message: 'Term is required' });
  }
  const trimmedTerm = term.trim();

  const data = await getAutocomplete(trimmedTerm);

  const filteredData = data.filter(
    (item: ItemAutocompleteRow) => item.brand !== 'Найти по описанию'
  );

  const dataWithId: ItemAutocompleteRow = filteredData.map(
    (element: ItemAutocompleteRow) => {
      return {
        id: uuidv4(),
        ...element,
      };
    }
  );

  res.json({ success: true, results: dataWithId });
};
