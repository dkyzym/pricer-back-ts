/**
 * Расширение типов Express: добавляет `req.user` с payload из JWT-токена.
 * Подхватывается глобально через declaration merging.
 */
export interface JwtPayload {
  username: string;
  role: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
