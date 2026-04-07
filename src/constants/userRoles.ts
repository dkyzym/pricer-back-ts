/** Значения поля `role` в JWT и в конфигурации пользователей. */
export const USER_ROLE = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type AppUserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];
