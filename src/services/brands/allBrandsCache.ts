import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAbcpAllBrands } from '../abcp/api/fetchAbcpAllBrands.js';
import { getAutosputnikAllBrands } from '../autosputnik/autosputnikApi.js';
import { standardizeString } from '../../utils/data/brand/standardizeString.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALL_BRANDS_CACHE_TTL_MONTHS = 6;

export const ALL_BRANDS_CACHE_PATH = path.resolve(
  __dirname,
  '../../../data/all-brands.json'
);

let allBrandsListCache: string[] | null = null;

export function getAllBrandsListSync(): string[] {
  if (allBrandsListCache) return allBrandsListCache;
  if (!fs.existsSync(ALL_BRANDS_CACHE_PATH)) return [];
  const raw = fs.readFileSync(ALL_BRANDS_CACHE_PATH, 'utf-8');
  const list = JSON.parse(raw) as string[];
  allBrandsListCache = list.filter((s) => typeof s === 'string' && s.trim().length > 0);
  return allBrandsListCache;
}

export function clearAllBrandsListCache(): void {
  allBrandsListCache = null;
}

type AllBrandsSyncReason = 'missing' | 'stale' | 'force' | 'fresh';

interface AllBrandsCacheState {
  exists: boolean;
  updatedAt: Date | null;
  refreshAfter: Date | null;
  isStale: boolean;
}

interface SyncAllBrandsCacheOptions {
  force?: boolean;
}

interface SyncAllBrandsCacheResult {
  updated: boolean;
  reason: AllBrandsSyncReason;
  path: string;
  brandsCount?: number;
  updatedAt: Date | null;
  refreshAfter: Date | null;
}

function addMonths(date: Date, months: number): Date {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function addBrand(map: Map<string, string>, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;

  const key = standardizeString(trimmed);
  if (map.has(key)) return;

  map.set(key, trimmed);
}

export function getAllBrandsCacheState(now = new Date()): AllBrandsCacheState {
  if (!fs.existsSync(ALL_BRANDS_CACHE_PATH)) {
    return {
      exists: false,
      updatedAt: null,
      refreshAfter: null,
      isStale: true,
    };
  }

  const stats = fs.statSync(ALL_BRANDS_CACHE_PATH);
  const updatedAt = stats.mtime;
  const refreshAfter = addMonths(updatedAt, ALL_BRANDS_CACHE_TTL_MONTHS);

  return {
    exists: true,
    updatedAt,
    refreshAfter,
    isStale: now >= refreshAfter,
  };
}

async function collectAllBrands(): Promise<string[]> {
  const byKey = new Map<string, string>();

  const [abcpBrands, autosputnikRes] = await Promise.all([
    fetchAbcpAllBrands('ug').catch(() => []),
    getAutosputnikAllBrands('autosputnik').catch((error) => {
      console.error('Autosputnik getbrandsAll:', error);
      return { error: 'fail', data: [] };
    }),
  ]);

  for (const item of abcpBrands) {
    addBrand(byKey, item.name);

    for (const alias of item.aliases ?? []) {
      addBrand(byKey, alias);
    }
  }

  if (!autosputnikRes.error && autosputnikRes.data?.length) {
    for (const item of autosputnikRes.data) {
      addBrand(byKey, item.name);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, 'ru'));
}

export async function syncAllBrandsCache(
  options: SyncAllBrandsCacheOptions = {}
): Promise<SyncAllBrandsCacheResult> {
  const cacheState = getAllBrandsCacheState();

  if (!options.force && cacheState.exists && !cacheState.isStale) {
    return {
      updated: false,
      reason: 'fresh',
      path: ALL_BRANDS_CACHE_PATH,
      updatedAt: cacheState.updatedAt,
      refreshAfter: cacheState.refreshAfter,
    };
  }

  const brands = await collectAllBrands();
  const outDir = path.dirname(ALL_BRANDS_CACHE_PATH);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(
    ALL_BRANDS_CACHE_PATH,
    JSON.stringify(brands, null, 2),
    'utf-8'
  );
  clearAllBrandsListCache();

  const updatedAt = new Date();
  const refreshAfter = addMonths(updatedAt, ALL_BRANDS_CACHE_TTL_MONTHS);

  return {
    updated: true,
    reason: options.force ? 'force' : cacheState.exists ? 'stale' : 'missing',
    path: ALL_BRANDS_CACHE_PATH,
    brandsCount: brands.length,
    updatedAt,
    refreshAfter,
  };
}
