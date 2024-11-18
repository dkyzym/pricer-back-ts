import { Browser, BrowserContext, Page } from 'puppeteer';
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
  private sessions: Map<string, Session> = new Map();

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

    const sessionID = generateSessionID(),
      context = await browser.createBrowserContext(),
      page = await context.newPage(),
      session: Session = {
        sessionID,
        supplier: name,
        context,
        page,
        socketID,
        accountAlias,
      },
      sessionKey = accountAlias ? `${name}_${accountAlias}` : name;

    this.sessions.set(sessionKey, session);
    await this.login(session, username, password);

    return session;
  }

  getSession(sessionKey: string): Session | undefined {
    return this.sessions.get(sessionKey);
  }

  async closeSessionsForSocket(socketID: string): Promise<void> {
    for (const [sessionID, session] of this.sessions.entries()) {
      if (session.socketID === socketID) {
        await session.page.close();
        await session.context.close();
        this.sessions.delete(sessionID);
      }
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
