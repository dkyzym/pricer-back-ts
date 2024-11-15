import { BrowserContext, Page } from 'puppeteer';
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
type suppliersParams = supplierParams[];

class SessionManager {
  private sessions: Map<string, Session> = new Map();

  async createSessionsForSocket(socketID: string): Promise<Session[]> {
    const browser = await initBrowser();

    const sessions: Session[] = [];

    const suppliers: suppliersParams = [
      // {
      //   name: 'turboCars',
      //   username: process.env.TURBOCARS_USERNAME || '',
      //   password: process.env.TURBOCARS_PASSWORD || '',
      //   accountAlias: 'nal',
      // },
      // {
      //   name: 'turboCars',
      //   username: process.env.TURBOCARS_USERNAME_BN || '',
      //   password: process.env.TURBOCARS_PASSWORD_BN || '',
      //   accountAlias: 'bezNal',
      // },
      // {
      //   name: 'patriot',
      //   username: process.env.PATRIOT_USERNAME || '',
      //   password: process.env.PATRIOT_PASSWORD || '',
      //   accountAlias: 'nal',
      // },
      {
        name: 'ug',
        username: process.env.UG_USERNAME || '',
        password: process.env.UG_PASSWORD || '',
        accountAlias: 'nal',
      },
    ];

    for (const supplierData of suppliers) {
      const { name, username, password, accountAlias } = supplierData;
      const sessionID = generateSessionID();
      const context = await browser.createBrowserContext();
      const page = await context.newPage();

      const session: Session = {
        sessionID,
        supplier: name,
        context,
        page,
        socketID,
        accountAlias,
      };
      const sessionKey = accountAlias ? `${name}_${accountAlias}` : name;
      this.sessions.set(sessionKey, session);
      sessions.push(session);

      await this.login(session, username, password);
    }
    return sessions;
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
