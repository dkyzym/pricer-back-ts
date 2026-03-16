import { Request, Response } from 'express';
import NodeCache from 'node-cache';
import { v4 as uuidv4 } from 'uuid';
import { getAutocomplete } from '../../services/getAutocomplete.js';
import { ItemAutocompleteRow } from '../../types/search.types.js';

// In-memory кэш на уровне процесса: снижает нагрузку на внешнее API,
// уменьшает риск блокировок/ограничений по частоте запросов и работает
// как простой щит от флудящих клиентов.
const cache = new NodeCache({ stdTTL: 3600 });

export const autocompleteUgController = async (req: Request, res: Response) => {
  const term = req.query.term as string;

  if (!term) {
    res.status(400).json({ success: false, message: 'Term is required' });
    return;
  }

  const trimmedTerm = term.trim();

  const cached = cache.get<ItemAutocompleteRow[]>(trimmedTerm);
  if (cached) {
    res.json({ success: true, results: cached });
    return;
  }

  const data = await getAutocomplete(trimmedTerm);

  const filteredData: ItemAutocompleteRow[] = data.filter(
    (item: ItemAutocompleteRow) => item.brand !== 'Найти по описанию'
  );

  const dataWithId: ItemAutocompleteRow[] = filteredData.map(
    (element: ItemAutocompleteRow) => {
      const isClarify = element.brand?.includes('Найти');
      return {
        id: uuidv4(),
        ...element,
        ...(isClarify ? { type: 'CLARIFY' } : {}),
      };
    }
  );

  cache.set(trimmedTerm, dataWithId);
  res.json({ success: true, results: dataWithId });
};
