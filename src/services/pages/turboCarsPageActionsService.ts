import { PageAction, pageActionsResult } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { loginTurboCars } from '../lugocar/loginTurboCarsService';
import { logoutTurboCarsService } from '../lugocar/logoutTurboCarsService';
import { getPage } from '../puppeteerShared/browserManager';

export const turboCarsPageActionsService = async (
  actionParams: PageAction
): Promise<pageActionsResult> => {
  const { action, supplier } = actionParams;
  const { loginURL } = getSupplierData(supplier);

  const page = await getPage(supplier, loginURL);

  try {
    console.log(`[${supplier}] Выполнение действия: ${action}`);

    switch (action) {
      case 'login': {
        const { username, password } = actionParams;
        return await loginTurboCars({
          page,
          username,
          password,
          supplier,
        });
      }

      case 'logout':
        return await logoutTurboCarsService(page, supplier);

      case 'pick': {
        return {
          success: true,
          message: `${supplier}: ${action} successful`,
          data: [
            {
              article: 'OC 90',
              brand: 'Mahle/Knecht',
              description: 'Фильтр масляный...',
              availability: 9999,
              price: 9999,
              warehouse: 'Краснодар',
              imageUrl: 'https://example.com/image.jpg',
              deadline: 0,
              deadLineMax: 0,
              probability: '',
              id: 'mock',
              supplier: 'turboCars',
            },
          ],
        };
      }

      default:
        return {
          success: false,
          message: `${supplier}: Invalid action`,
        };
    }
  } catch (error) {
    console.error(
      `${supplier}: Error performing ${action} action on Page Auth Actions:`,
      error
    );
    return {
      success: false,
      message: `${supplier}: An error occurred during the ${action} action`,
    };
  }
};
