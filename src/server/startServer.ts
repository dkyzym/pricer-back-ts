import axios from 'axios';
import chalk from 'chalk';
import { PORT } from 'config';
import { logger } from 'config/logger';
import type { Application } from 'express';
import { Server as HTTPServer } from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { AddressInfo } from 'net';
import { initializeSocket } from '../sockets';

const proxyHost = '172.25.197.156';
const proxyPort = 808;
const proxyAuth = 'username:password'; // Если используете авторизацию, иначе опустите
const proxyUrl = `http://${proxyHost}:${proxyPort}`;

const agent = new HttpsProxyAgent(proxyUrl);

// const URL = `https://id9065.public.api.abcp.ru/search/articles/?userlogin=automir.lg@gmail.com&userpsw=c7cabee3f7f71189a46df2955930d063&number=sm105&brand=sct`;
const username = 'automir.lg@gmail.com';
const md5pass = 'c7cabee3f7f71189a46df2955930d063';
const searchBrandURI = `https://id9065.public.api.abcp.ru/search/brands/?userlogin=automir.lg@gmail.com&userpsw=c7cabee3f7f71189a46df2955930d063&number=sp1165&useOnlineStocks=0`;
export const startServer = async (app: Application) => {
  try {
    const server: HTTPServer = app.listen(PORT, () => {
      logger.info(
        chalk.cyan.italic(
          `Server is running. Use port: ${(server.address() as AddressInfo).port}`
        )
      );
    });

    axios
      .get('http://api.ipify.org?format=json', {
        httpAgent: agent,
        httpsAgent: agent,
      })
      .then((response) => {
        console.log(chalk.cyan.italic('IP через прокси:', response.data));
      })
      .catch((error) => {
        console.error('Ошибка прокси:', error);
      });

    initializeSocket(server);
  } catch (e) {
    logger.error((e as Error).message);
  }
};
