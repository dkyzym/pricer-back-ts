import dotenv from 'dotenv';
import chalk from 'chalk';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
