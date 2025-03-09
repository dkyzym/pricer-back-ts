import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 3000;
export const CLIENT_URL = [
  `${process.env.CLIENT_URL}`,
  `${process.env.HTTP_SITE}`,
  `${process.env.HTTPS_SITE}`,
  'http://localhost:3000',
];

export const corsOptions = {
  origin: '*',
  credentials: true,
};
