import fs from 'fs/promises';
import path from 'path';
import { CookieJar } from 'tough-cookie';
import { UG_AUTOCOMPLETE_COOKIE_FILE } from '../../config/index.js';
import { logger } from '../../config/logger/index.js';

const PERSIST_DEBOUNCE_MS = 1500;

/**
 * Замыкание: debounce записи на диск, чтобы при серии запросов не дергать FS на каждый ответ.
 * Состояние таймера — один на процесс; jar всегда тот же экземпляр после bootstrap.
 */
const schedulePersistUgCookieJar = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (jar: CookieJar): void => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void persistUgCookieJarNow(jar);
    }, PERSIST_DEBOUNCE_MS);
  };
})();

/**
 * Сохраняет сериализованный CookieJar в JSON-файл (атомарная замена через временный файл).
 */
const persistUgCookieJarNow = async (jar: CookieJar): Promise<void> => {
  try {
    const serialized = await jar.serialize();
    const dir = path.dirname(UG_AUTOCOMPLETE_COOKIE_FILE);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${UG_AUTOCOMPLETE_COOKIE_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(serialized), 'utf8');
    await fs.rename(tmpPath, UG_AUTOCOMPLETE_COOKIE_FILE);
  } catch (error) {
    logger.warn('Не удалось сохранить cookie jar автокомплита UG на диск', { error });
  }
};

/**
 * Загружает jar с диска или создаёт пустой MemoryCookieStore.
 */
export const loadUgCookieJarFromFile = async (): Promise<CookieJar> => {
  try {
    const raw = await fs.readFile(UG_AUTOCOMPLETE_COOKIE_FILE, 'utf8');
    const serialized = JSON.parse(raw);
    const jar = await CookieJar.deserialize(serialized);
    const cookieCount = serialized?.cookies?.length ?? 0;
    logger.info(`Cookie jar автокомплита UG загружен с диска (${cookieCount} кук)`);
    return jar;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      logger.info('Файл cookie автокомплита UG не найден — стартуем с пустым jar');
    } else {
      logger.warn('Файл cookie автокомплита UG не прочитан, создаём новый jar', {
        error,
      });
    }
    return new CookieJar();
  }
};

export { schedulePersistUgCookieJar };
