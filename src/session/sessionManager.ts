import { Browser, BrowserContext, HTTPRequest, Page } from 'puppeteer';
import { logger } from '../config/logger';
import { initBrowser } from '../services/browserManager';
import { loginPatriotService } from '../services/patriot/loginPatriotService';
import { loginTurboCarsService } from '../services/turboCars/loginTurboCarsService';
import { loginUgService } from '../services/ug/loginUgService';
import { accountAlias, SupplierName } from '../types';
import { getSupplierData } from '../utils/data/getSupplierData';
import { generateSessionID } from '../utils/generateSessionID';

interface Session {
  sessionID: string;
  supplier: SupplierName;
  context: BrowserContext;
  page: Page;
  socketID: string;
  accountAlias: accountAlias;
}

interface supplierParams {
  name: SupplierName;
  username: string;
  password: string;
  accountAlias: accountAlias;
}
type SuppliersParams = supplierParams[];

class SessionManager {
  private sessions = new Map<string, Map<string, Session>>();

  async createSessionsForSocket(socketID: string): Promise<Session[]> {
    const browser = await initBrowser();

    const sessions: Session[] = [];

    const suppliers: SuppliersParams = [
      {
        name: 'turboCars',
        username: process.env.TURBOCARS_USERNAME || '',
        password: process.env.TURBOCARS_PASSWORD || '',
        accountAlias: 'nal',
      },
      {
        name: 'turboCars',
        username: process.env.TURBOCARS_USERNAME_BN || '',
        password: process.env.TURBOCARS_PASSWORD_BN || '',
        accountAlias: 'bezNal',
      },
      {
        name: 'patriot',
        username: process.env.PATRIOT_USERNAME || '',
        password: process.env.PATRIOT_PASSWORD || '',
        accountAlias: 'nal',
      },
      {
        name: 'ug',
        username: process.env.UG_USERNAME || '',
        password: process.env.UG_PASSWORD || '',
        accountAlias: 'nal',
      },
    ];

    const ugSupplier = suppliers.find((s) => s.name === 'ug');
    const otherSuppliers = suppliers.filter((s) => s.name !== 'ug');

    if (ugSupplier) {
      try {
        const session = await this.createSessionForSupplier(
          ugSupplier,
          browser,
          socketID
        );
        sessions.push(session);
      } catch (error: any) {
        await browser.close();
        logger.error(`Ошибка инициализации поставщика 'ug': ${error.stack}`);
        throw new Error(
          `Ошибка инициализации поставщика 'ug': ${error.message}`
        );
      }
    }

    const pages = await browser.pages();
    for (const page of pages) {
      if (page.url() === 'about:blank') {
        await page.close();
      }
    }

    const otherSessionsPromises = otherSuppliers.map((supplier) =>
      this.createSessionForSupplier(supplier, browser, socketID).catch(
        (error) => {
          logger.error(
            `Не удалось инициализировать поставщика '${supplier.name}_${supplier.accountAlias}': ${error.message}`
          );
          return null;
        }
      )
    );

    const otherSessions = await Promise.all(otherSessionsPromises);
    sessions.push(
      ...(otherSessions.filter((session) => session !== null) as Session[])
    );

    return sessions;
  }

  private async createSessionForSupplier(
    supplierParams: supplierParams,
    browser: Browser,
    socketID: string
  ): Promise<Session> {
    const { name, username, password, accountAlias } = supplierParams;
    const sessionID = generateSessionID();
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    await this.setupPage(page);

    const session: Session = {
        sessionID,
        supplier: name,
        context,
        page,
        socketID,
        accountAlias,
      },
      sessionKey = accountAlias ? `${name}_${accountAlias}` : name;

    let socketSessions = this.sessions.get(socketID);
    if (!socketSessions) {
      socketSessions = new Map<string, Session>();
      this.sessions.set(socketID, socketSessions);
    }

    // Store the session under sessionKey
    socketSessions.set(sessionKey, session);

    await this.login(session, username, password);
    return session;
  }

  private async setupPage(page: Page): Promise<void> {
    const waitTimeOutPeriod = 60_000;
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ru-RU,ru;q=0.9' });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // @ts-ignore
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ru-RU', 'ru'],
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });
    await page.setRequestInterception(true);
    page.on('request', (request: HTTPRequest) => {
      const resourceType = request.resourceType();
      const headers = {
        ...request.headers(),
        'Accept-Language': 'ru-RU,ru;q=0.9',
      };
      if (['image', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue({ headers });
      }
    });
    page.on('pageerror', (err) => logger.error(`${page?.url()}, ${err}`));
    page.on('error', (err) =>
      logger.error(`Page crashed ${page?.url()}: ${err}`)
    );
    page.on('requestfailed', (request) =>
      logger.warn(
        `Request failed: ${request.url()} ${request.failure()?.errorText}`
      )
    );
    page.on('response', (response) => {
      if (!response.ok()) {
        logger.warn(
          `Response warn: ${response.url()} Status: ${response.status()}`
        );
      }
    });

    try {
      await page.waitForFunction(() => document.readyState === 'complete', {
        timeout: waitTimeOutPeriod,
      });
    } catch (error) {
      logger.error(`Error during waitForFunction: ${error}`);
    }
  }

  getSession(socketID: string, sessionKey: string): Session | undefined {
    const socketSessions = this.sessions.get(socketID);
    return socketSessions ? socketSessions.get(sessionKey) : undefined;
  }

  getSessionBySessionID(sessionID: string): Session | undefined {
    for (const socketSessions of this.sessions.values()) {
      for (const session of socketSessions.values()) {
        if (session.sessionID === sessionID) {
          return session;
        }
      }
    }
    return undefined;
  }

  async closeSessionsForSocket(socketID: string): Promise<void> {
    const socketSessions = this.sessions.get(socketID);
    if (socketSessions) {
      for (const session of socketSessions.values()) {
        await session.page.close();
        await session.context.close();
      }
      this.sessions.delete(socketID);
    }
  }

  private async login(
    session: Session,
    username: string,
    password: string
  ): Promise<void> {
    const { page, supplier } = session;
    const { loginURL } = getSupplierData(supplier);

    await page.goto(loginURL);

    if (supplier === 'ug') {
      await loginUgService({
        page,
        username,
        password,
        supplier,
      });
    }

    if (supplier === 'patriot') {
      await loginPatriotService({
        page,
        username,
        password,
        supplier,
      });
    }

    if (supplier === 'turboCars') {
      await loginTurboCarsService({
        page,
        username,
        password,
        supplier,
      });
    }
  }
}

export const sessionManager = new SessionManager();
