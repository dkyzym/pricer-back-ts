export type SupplierName =
  | 'ug'
  | 'ug_f'
  | 'ug_bn'
  | 'patriot'
  | 'profit'
  | 'autosputnik'
  | 'autosputnik_bn'
  | 'autoImpulse'
  | 'armtek'
  | 'mikano'
  | 'avtodinamika'
  | 'avtoPartner'
  | 'npn';

export type AccountAlias = 'nal' | 'bezNal';

/** Структура данных о пользователе в памяти */
export interface User {
  username: string;
  role: 'admin' | 'user' | string;
  password: string; // В идеале здесь должен быть хэш
}

export interface SessionData {
  cookies: any[]; // Рассмотреть возможность более строгой типизации
  localStorage: { [key: string]: string };
  sessionStorage: { [key: string]: string };
}
