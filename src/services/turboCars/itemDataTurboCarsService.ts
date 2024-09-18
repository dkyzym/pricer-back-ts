import chalk from 'chalk';
import { ParallelSearchParams } from 'types';
import { inspect } from 'util';
import { SUPPLIERS_DATA } from 'utils/data/constants';
import { fillField, waitForPageNavigation } from 'utils/pupHelpers/pageHelpers';

export const itemDataTurboCarsService = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<any> => {
  const { selectors } = SUPPLIERS_DATA[supplier];
  console.log(inspect({ page, item, supplier }, { colors: true, depth: 2 }));

  console.log(
    inspect(page.url(), { colors: true, showHidden: true, depth: 5 })
  );

  await fillField(page, selectors.input, item.article);

  await page.keyboard.press('Enter');

  await waitForPageNavigation(page, { waitUntil: 'networkidle2' });

  // сервис для парсинга

  /**
   *  нулевой элемент списка, # block0
   *  берем текс контент  #block0 a
   *  убираем префикс - оставляем все после тире,
   *  сравниваем с артикулом item.article.toLowerCase()
   * если строка есть
   *       кликаем по ней
   *      ждем перехода на другую страницу
   * если строки нет
   *      возвращаем пустой массив
   *
   */

  // const element = page.locator(`tr[data-url="${item.dataUrl}"]`);
  // await element.hover();
  // await element.click();

  // const allResults = await parsePickedUgResults(page, item, supplier);

  // console.log(
  //   chalk.bgYellowBright(
  //     `Найдено результатов перед возвратом: ${allResults.length}`
  //   )
  // );

  console.log(
    chalk.bgYellowBright(
      `Найдено результатов перед возвратом ${supplier} :  ${'allResults'.length}`
    )
  );

  return [
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
  ];
};
