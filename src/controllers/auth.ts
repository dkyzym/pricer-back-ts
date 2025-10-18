import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { User } from '../types';
dotenv.config();

const { JWT_SECRET, USERS } = process.env;

// Разберём USERS="Den:admin:DenPass;Sergey:user:SergeyPass;Julia:user:JuliaPass"
const parseUsersFromEnv = (): User[] => {
  if (!USERS) return [];
  return USERS.split(';').map((userStr) => {
    const [username, role, password] = userStr.split(':');
    return { username, role, password };
  });
};

const allUsers = parseUsersFromEnv(); // массив всех пользователей

// Простая проверка логина/пароля (возвращает объект пользователя или null)
export const authenticateUser = (
  username: string,
  password: string
): Omit<User, 'password'> | null => {
  const found = allUsers.find(
    (u) => u.username === username && u.password === password
  );
  if (!found) return null;
  // Возвращаем "без пароля"
  const { password: _, ...userWithoutPass } = found;
  return userWithoutPass;
};

// Генерация JWT с инфой о пользователе
export const signToken = (user: Omit<User, 'password'>): string => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not provided');
  }
  // В payload можно положить username, role
  return jwt.sign(
    { username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '80h' } // срок жизни токена
  );
};

// Валидация и декодирование токена (возвращает payload, если валиден)
export const verifyToken = (
  token: string
): { username: string; role: string; iat: number; exp: number } => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not provided');
  }
  return jwt.verify(token, JWT_SECRET) as {
    username: string;
    role: string;
    iat: number;
    exp: number;
  };
};
