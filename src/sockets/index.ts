import axios, { AxiosError } from 'axios';
import chalk from 'chalk';
import { CLIENT_URL } from 'config/index.js';
import { logger } from 'config/logger/index.js';
import { Server as HTTPServer } from 'http';
import { getItemsListByArticleService } from 'services/profit/getItemsListByArticleService.js';
import { getItemsWithRest } from 'services/profit/getItemsWithRest.js';
import { Server as SocketIOServer } from 'socket.io';
import {
  ClarifyBrandResult,
  getItemResultsParams,
  itemsGroupProfit,
  pageActionsResult,
  ProviderErrorData,
  SearchResultsParsed,
} from 'types/index.js';
import { isBrandMatch } from 'utils/data/isBrandMatch.js';
import { parseProfitApiResponse } from 'utils/data/profit/parseProfitApiResponse.js';
import { SOCKET_EVENTS } from '../constants/socketEvents.js';
import { verifyToken } from '../controllers/auth.js';
import { parseArmtekResults } from '../services/armtek/parseArmtekResults.js';
import { searchArmtekArticle } from '../services/armtek/searchArmtekArticle.js';
import { getCachedStoreList } from '../services/armtek/storeList.js';
import { itemDataAutoImpulseService } from '../services/autoimpulse/itemDataAutoImpulseService.js';
import { clarifyBrand } from '../services/clarifyBrand.js';
import { itemDataPatriotService } from '../services/patriot/itemDataPatriotService.js';
import { searchTurbocarsCode } from '../services/turboCars/searchTurboCarsCode.js';
import { fetchUgData } from '../services/ug/fetchUgData/fetchUgData.js';
import { mapUgResponseData } from '../services/ug/mapUgResponseData.js';
import { parseAutosputnikData } from '../utils/data/autosputnik/parseAutosputnikData.js';
import { isContainsBrandName } from '../utils/data/isContainsBrandName.js';
import { filterAndSortAllResults } from '../utils/filterAndSortAllResults.js';
import { parseXmlToSearchResults } from '../utils/mapData/mapTurboCarsData.js';
import { logResultCount } from '../utils/stdLogs.js';

enum ProviderErrorCodes {
  ObjectNotFound = 301,
  // ... доп. коды по необходимости
}

export const initializeSocket = (server: HTTPServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.query.token as string | undefined;
      if (!token) {
        return next(new Error('No token provided'));
      }
      // Проверяем и декодируем токен
      const payload = verifyToken(token);
      // Сохраняем данные в socket.data, чтобы дальше использовать
      socket.data.user = {
        username: payload.username,
        role: payload.role,
      };
      next();
    } catch (err) {
      // Если валидация токена упала
      return next(err as any);
    }
  });

  io.on('connection', async (socket) => {
    const userLogger = logger.child({
      user: socket.data.user?.username,
      role: socket.data.user?.role,
      socketId: socket.id,
    });

    userLogger.info(chalk.cyan(`New client connected`));

    socket.emit(SOCKET_EVENTS.CONNECT, { message: 'Connected to server' });

    socket.on(SOCKET_EVENTS.BRAND_CLARIFICATION, async (data) => {
      userLogger.info(`Received BRAND_CLARIFICATION event:`, data);
      const { query } = data;

      if (!query || query.trim() === '') {
        userLogger.info(
          `Empty query received for BRAND_CLARIFICATION from socket ${socket.id}`
        );
        socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_RESULTS, {
          query: '',
          results: [],
        });
        return;
      }

      try {
        userLogger.info(`Processing BRAND_CLARIFICATION for query "${query}"`);

        const result: ClarifyBrandResult = await clarifyBrand(
          query,
          userLogger
        );

        if (result.success) {
          userLogger.info(
            `BRAND_CLARIFICATION success, found: ${result.brands.length}`
          );
          socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_RESULTS, {
            brands: result.brands,
            message: result.message,
          });
        } else {
          userLogger.error(`BRAND_CLARIFICATION failed `, result.message);
          socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_ERROR, {
            message: result.message,
          });
        }
      } catch (error) {
        userLogger.error('Brand Clarification error:', error);
        socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_ERROR, {
          message: `Error clarifying brand: ${(error as Error).message}`,
        });
      }
    });

    socket.on(
      SOCKET_EVENTS.GET_ITEM_RESULTS,
      async (data: getItemResultsParams) => {
        const { item, supplier } = data;

        userLogger.info(
          `Received GET_ITEM_RESULTS event: ${JSON.stringify(data)}`
        );

        if (!supplier) {
          userLogger.error('Supplier is undefined in GET_ITEM_RESULTS');
          return;
        }

        if (supplier === 'profit') {
          try {
            userLogger.info(
              `Fetching data from ${supplier} for item: ${JSON.stringify(item)}`
            );
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: 'profit',
              article: item.article,
            });

            const items: itemsGroupProfit = await getItemsListByArticleService(
              item.article
            );
            const itemsWithRest = await getItemsWithRest(items, userLogger);

            const relevantItems = itemsWithRest.filter(({ brand }: any) => {
              return (
                isBrandMatch(item.brand, brand) ||
                isContainsBrandName(item.brand, brand)
              );
            });

            const profitParsedData = parseProfitApiResponse(
              relevantItems,
              item.brand,
              userLogger
            );

            const filteredItems = filterAndSortAllResults(profitParsedData);

            logResultCount(item, userLogger, supplier, profitParsedData);
            userLogger.info(
              chalk.bgYellow(
                `После фильтрации: ${supplier} - ${filteredItems?.length}`
              )
            );

            const profitResult: pageActionsResult = {
              success: profitParsedData.length > 0,
              message: `Profit data fetched: ${filteredItems.length > 0}`,
              data: filteredItems,
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier: 'profit',
              result: profitResult,
            });
          } catch (error) {
            userLogger.error('Profit error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier: 'profit',
              error: (error as Error).message,
            });
          }
        } else if (supplier === 'autosputnik') {
          try {
            userLogger.info(
              `Fetching data from ${supplier} for item: ${JSON.stringify(item)}`
            );

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: 'autosputnik',
              article: item.article,
            });

            const autoSputnikData = await parseAutosputnikData(
              item,
              userLogger
            );

            logResultCount(item, userLogger, supplier, autoSputnikData);

            const filteredItems = filterAndSortAllResults(autoSputnikData);
            userLogger.info(
              chalk.bgYellow(
                `После фильтрации: ${supplier} - ${filteredItems?.length}`
              )
            );

            const autosputnikResult: pageActionsResult = {
              success: true,
              message: `Autosputnik data fetched: ${autoSputnikData?.length}`,
              data: filteredItems,
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier: 'autosputnik',
              result: autosputnikResult,
            });
          } catch (error) {
            userLogger.error('Autosputnik error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier: 'autosputnik',
              error: (error as Error).message,
            });
          }
        } else if (supplier === 'ug') {
          try {
            userLogger.info(
              `Fetching data from ${supplier} for item: ${JSON.stringify(item)}`
            );

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: 'ug',
              article: item.article,
            });

            // 1. Запрашиваем данные у поставщика.
            const data = await fetchUgData(item.article, item.brand);

            // 2. Преобразуем ответ в удобный формат.
            const mappedUgResponseData = mapUgResponseData(
              data,
              item.brand,
              userLogger
            );
            // 3. Логируем, сколько результатов получили (вдруг пригодится).
            logResultCount(item, userLogger, supplier, mappedUgResponseData);

            const filteredItems = filterAndSortAllResults(mappedUgResponseData);
            userLogger.info(
              chalk.bgYellow(
                `После фильтрации: ${supplier} - ${filteredItems?.length}`
              )
            );

            // 4. Формируем результат.
            const ugResult = {
              success: mappedUgResponseData.length > 0,
              message: `Ug data fetched: ${filteredItems.length > 0}`,
              data: filteredItems,
            };

            // 5. Отправляем клиенту.
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier: 'ug',
              result: ugResult,
            });
          } catch (err: unknown) {
            // Чтобы не "уронить" сервер, НЕ выбрасываем (throw) ошибку дальше.

            // 1. Проверяем, является ли это AxiosError.
            if (!axios.isAxiosError(err)) {
              // => НЕ Axios-ошибка.
              userLogger.error('UG supplier: Non-Axios error occurred.', {
                message: (err as Error)?.message,
                stack: (err as Error)?.stack,
              });

              // Сообщаем клиенту об ошибке
              socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
                supplier: 'ug',
                error: (err as Error)?.message || 'Unknown non-Axios error',
              });
              return; // Завершаем обработку
            }

            // 2. Это AxiosError
            const axiosError = err as AxiosError<ProviderErrorData>;

            // 3. Если нет response, значит это сетевая или «неизвестная» ошибка
            if (!axiosError.response) {
              userLogger.error('UG supplier: Network or unknown error', {
                message: axiosError.message,
                stack: axiosError.stack,
              });

              socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
                supplier: 'ug',
                error: axiosError.message || 'Unknown network error',
              });
              return; // Завершаем обработку
            }

            // 4. Ответ есть, значит статус >= 400
            const { data: providerData, status } = axiosError.response;
            const errorCode = providerData?.errorCode;
            const errorMessage = providerData?.errorMessage;

            // 5. Проверка «Ожидаемых» ошибок (301 — "ObjectNotFound")
            if (errorCode === ProviderErrorCodes.ObjectNotFound) {
              userLogger.warn(
                `UG supplier: "no results" from provider (code=${errorCode}, message="${errorMessage}").`
              );

              const ugResult = {
                success: true,
                message: 'Ничего не нашли',
                data: [],
              };
              socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
                supplier: 'ug',
                result: ugResult,
              });
              return; // Завершаем обработку
            }

            // 6. Любая другая ошибка поставщика: логируем выборочно
            let responseDataSnippet = '';
            try {
              if (axiosError.response.data) {
                const rawData = JSON.stringify(axiosError.response.data);
                responseDataSnippet = rawData.slice(0, 300); // «отрезаем» большой ответ
              }
            } catch (jsonErr) {
              // На случай, если data вообще не сериализуется
              responseDataSnippet = '[Failed to serialize response data]';
            }

            // Логируем на уровне error, но только нужные детали
            userLogger.error(
              `UG supplier error: code=${errorCode}, message="${errorMessage}", httpStatus=${status}`,
              {
                stack: axiosError.stack,
                config: {
                  url: axiosError.config?.url,
                  method: axiosError.config?.method,
                },
                dataSnippet: responseDataSnippet,
              }
            );

            // Отправляем событие об ошибке клиенту
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier: 'ug',
              error: errorMessage || axiosError.message,
            });
          }
        } else if (supplier === 'patriot') {
          try {
            userLogger.info(
              `Fetching data from ${supplier} for item: ${JSON.stringify(item)}`
            );

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: 'patriot',
              article: item.article,
            });

            const data = await itemDataPatriotService({
              item,
              supplier,
              userLogger,
            });

            logResultCount(item, userLogger, supplier, data);

            const filteredItems = filterAndSortAllResults(data);
            userLogger.info(
              chalk.bgYellow(
                `После фильтрации: ${supplier} - ${filteredItems?.length}`
              )
            );

            const patriotResult: pageActionsResult = {
              success: data.length > 0,
              message: `Patriot data fetched: ${data.length > 0}`,
              data: filteredItems,
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier: 'patriot',
              result: patriotResult,
            });
          } catch (error) {
            userLogger.error('Patriot error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier: 'patriot',
              error: (error as Error).message,
            });
          }
        } else if (supplier === 'autoImpulse') {
          try {
            userLogger.info(
              `Fetching data from ${supplier} for item: ${JSON.stringify(item)}`
            );

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier,
              article: item.article,
            });

            const data = await itemDataAutoImpulseService({
              item,
              supplier,
              userLogger,
            });
            logResultCount(item, userLogger, supplier, data);

            const filteredItems = filterAndSortAllResults(data);
            userLogger.info(
              chalk.bgYellow(
                `После фильтрации: ${supplier} - ${filteredItems?.length}`
              )
            );

            const autoImpulseResult: pageActionsResult = {
              success: data.length > 0,
              message: `AutoImpulse data fetched: ${data.length > 0}`,
              data: filteredItems,
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier,
              result: autoImpulseResult,
            });
          } catch (error) {
            userLogger.error('AutoImpulse error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier,
              error: (error as Error).message,
            });
          }
        } else if (supplier === 'turboCars') {
          try {
            userLogger.info(
              `Fetching data from ${supplier} for item: ${JSON.stringify(item)}`
            );
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: supplier,
              article: item.article,
            });

            const withAnalogs = 0;
            const codeSearchResult = await searchTurbocarsCode(item.article);
            const data = parseXmlToSearchResults(
              codeSearchResult,
              item.brand,
              withAnalogs,
              userLogger
            );

            logResultCount(item, userLogger, supplier, data);
            const filteredItems = filterAndSortAllResults(data);
            userLogger.info(
              chalk.bgYellow(
                `После фильтрации: ${supplier} - ${filteredItems?.length}`
              )
            );

            const turboCarsResult: pageActionsResult = {
              success: data.length > 0,
              message: `TurboCars data fetched: ${data.length > 0}`,
              data: filteredItems,
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier,
              result: turboCarsResult,
            });
          } catch (error) {
            userLogger.error('TurboCars error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier,
              error: (error as Error).message,
            });
          }
        } else if (supplier === 'armtek') {
          try {
            userLogger.info(
              `Fetching data from ${supplier} for item: ${JSON.stringify(item)}`
            );

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: supplier,
              article: item.article,
            });

            const { RESP, STATUS, MESSAGES } = await searchArmtekArticle(
              {
                PIN: item.article,
              },
              userLogger
            );

            if (!RESP || !RESP.length) {
              userLogger.warn(JSON.stringify({ STATUS, MESSAGES }));

              const armtekResult: pageActionsResult = {
                success: true,
                message: `Armtek data fetched: 0`,
                data: [],
              };

              socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
                supplier: 'armtek',
                result: armtekResult,
              });

              return [];
            }

            const relevantItems = RESP.filter((resItem) =>
              isBrandMatch(item.brand, resItem.BRAND || '')
            );

            const storeList = await getCachedStoreList();

            const parsedArmtekResults: SearchResultsParsed[] =
              parseArmtekResults(relevantItems, storeList);

            logResultCount(item, userLogger, supplier, parsedArmtekResults);
            const filteredItems = filterAndSortAllResults(parsedArmtekResults);
            userLogger.info(
              chalk.bgYellow(
                `После фильтрации: ${supplier} - ${filteredItems?.length}`
              )
            );

            const armtekResult: pageActionsResult = {
              success: parsedArmtekResults.length > 0,
              message: `Armtek data fetched: ${parsedArmtekResults.length > 0}`,
              data: filteredItems,
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier: 'armtek',
              result: armtekResult,
            });
          } catch (error) {
            userLogger.error('Armtek error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier: 'armtek',
              error: (error as Error).message,
            });
          }
        }
      }
    );

    // Disconnect Handler
    socket.on('disconnect', () => {
      userLogger.info(chalk.bgCyan(`Client disconnected:`));
    });
  });
};
