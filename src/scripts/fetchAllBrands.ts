import 'dotenv/config';
import { syncAllBrandsCache } from '../services/suppliers/brands/allBrandsCache.js';

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const result = await syncAllBrandsCache({ force });

  if (result.updated) {
    console.log(`Записано ${result.brandsCount} уникальных брендов в ${result.path}`);
    console.log(
      `Следующее обновление после ${result.refreshAfter?.toISOString() ?? 'unknown'}`
    );
    return;
  }

  console.log(`Пропуск обновления: кэш брендов актуален до ${result.refreshAfter?.toISOString() ?? 'unknown'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
