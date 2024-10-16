// import { PageAction, pageActionsResult } from 'types';
// import { getSupplierData } from 'utils/data/getSupplierData';
// import { loginOrionService } from '../orion/loginOrionService';
// import { logoutOrionService } from '../orion/logoutOrionService';
// import { getPage } from '../puppeteerShared/browserManager';

// export const orionPageActionsService = async (
//   actionParams: PageAction
// ): Promise<pageActionsResult> => {
//   const { action, supplier } = actionParams;
//   const { dashboardURL } = getSupplierData(supplier);
//   const page = await getPage(dashboardURL as string);

//   try {
//     switch (action) {
//       case 'login': {
//         const { username, password } = actionParams;
//         return await loginOrionService({
//           page,
//           username,
//           password,
//           supplier,
//         });
//       }
//       case 'logout':
//         return await logoutOrionService(page, supplier);
//       default:
//         return {
//           success: false,
//           message: `${supplier}: Invalid action`,
//         };
//     }
//   } catch (error) {
//     logger.error(
//       `${supplier}: Error performing ${action} action on Orion Page Auth Actions:`,
//       error
//     );
//     return {
//       success: false,
//       message: `${supplier}: An error occurred during the ${action} action`,
//     };
//   }
// };
