# Руководство по системе расчета дат поставки

## Введение: Философия системы

**Основная идея этой архитектуры — отделить ****ЧТО** мы хотим сделать от **КАК** мы это делаем.

* **ЧТО (Конфигурация):** Правила каждого поставщика. Они описаны в файле `<span class="selected">suppliersConfig.declarative.ts</span>` на простом, почти человеческом языке в виде объектов. Это бизнес-логика.
* **КАК (Движок):** Механизм, который умеет "читать" эти правила и выполнять все математические операции с датами. Он находится в файле `<span class="selected">deliveryCalculator.ts</span>`.

**Вам, как разработчику, в 99% случаев нужно будет работать только с файлом конфигурации. Движок — это "черный ящик", который просто выполняет свою работу.**

## Три кита системы

1. **`<span class="selected">types/dateTypes.d.ts</span>` — Конституция.**
   * **Что это?** Самый главный файл для понимания системы. Он определяет все возможные "слова" и "конструкции", которые вы можете использовать для описания правил поставщика. Это наш с вами словарь и грамматика.
   * **Когда использовать?** Всегда держите его под рукой, когда создаете или изменяете конфигурацию. TypeScript, опираясь на эти типы, не даст вам совершить ошибку.
2. **`<span class="selected">suppliersConfig/suppliersConfig.declarative.ts</span>` — Библиотека правил.**
   * **Что это?** Сердце вашей бизнес-логики. Это массив объектов, где каждый объект — полная и исчерпывающая инструкция по расчету даты для одного поставщика.
   * **Когда использовать?** Это основной файл, который вы будете редактировать при добавлении нового поставщика или изменении правил для старого.
3. **`<span class="selected">deliveryCalculator.ts</span>` — Движок.**
   * **Что это?** Исполнительный механизм. Он не знает ничего о "Патриоте" или "NPN". Он просто берет конфигурацию, смотрит на ее `<span class="selected">strategy</span>` и запускает соответствующую функцию расчета.
   * **Когда использовать?** Вам не нужно его трогать, если только не появится поставщик с абсолютно новой, уникальной механикой, которой нет среди существующих стратегий.

## Глубокое погружение: Стратегии расчета

**Стратегия — это основной способ описания логики поставщика. Вы выбираете одну из четырех, которая лучше всего подходит под его правила.**

### Стратегия 1: `<span class="selected">DIRECT_FROM_API</span>`

* **Когда использовать?** Самый простой случай. Используйте, когда API поставщика уже возвращает готовую, финальную дату доставки в одном из полей.
* **Ключевые поля:**
  * `<span class="selected">strategy</span>`: Всегда `<span class="selected">'DIRECT_FROM_API'</span>`.
  * `<span class="selected">sourceField</span>`: Название поля в объекте `<span class="selected">result</span>`, из которого нужно взять дату (например, `<span class="selected">'deliveryDate'</span>`).
  * `<span class="selected">avoidDeliveryWeekdays</span>` (необязательно): Массив дней недели (1-Пн, 7-Вс), на которые не должна выпадать доставка. Если дата попадет на такой день, она автоматически сдвинется вперед.
* **Пример:**
  ```
  {
    supplierName: 'profit',
    calculation: {
      strategy: 'DIRECT_FROM_API',
      sourceField: 'deliveryDate',
      avoidDeliveryWeekdays: [7], // Если API вернет воскресенье, сдвинуть на понедельник
    }
  }

  ```

### Стратегия 2: `<span class="selected">RULE_BASED</span>`

* **Когда использовать?** Для сложной логики, которая зависит от  **конкретного дня недели и времени заказа** **. Представляйте ее как цепочку правил "ЕСЛИ заказали в этот промежуток, ТО доставить вот так".**
* **Ключевые поля:**
  * `<span class="selected">strategy</span>`: Всегда `<span class="selected">'RULE_BASED'</span>`.
  * `<span class="selected">rules</span>`: Массив объектов-правил. Движок будет проверять их по порядку и остановится на первом, которое сработает.
* **Структура одного правила (`<span class="selected">Rule</span>`):**
  * `<span class="selected">ifPlaced</span>`: Описывает условие.
    * `<span class="selected">from: { weekday: 1, time: '14:00' }</span>`: Начало временного окна.
    * `<span class="selected">to: { weekday: 4, time: '13:59' }</span>`: Конец временного окна.
  * `<span class="selected">thenDeliver</span>`: Описывает действие, если условие выполнено.
    * `<span class="selected">type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 5</span>`: Найти ближайшую пятницу (weekday: 5).
    * `<span class="selected">type: 'AFTER_DAYS', days: 1</span>`: Просто прибавить 1 день к дате заказа.
* **Пример (`<span class="selected">avtoPartner</span>`):**
  ```
  {
    supplierName: 'avtoPartner',
    calculation: {
      strategy: 'RULE_BASED',
      rules: [
        // Правило 1: Заказ в понедельник до 14:00 -> доставка во вторник
        {
          ifPlaced: { from: { weekday: 1, time: '00:00' }, to: { weekday: 1, time: '13:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 2 }
        },
        // Правило 2: Заказ с 14:00 понедельника до 13:59 четверга -> доставка в пятницу
        {
          ifPlaced: { from: { weekday: 1, time: '14:00' }, to: { weekday: 4, time: '13:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 5 }
        },
        // ... и так далее
      ]
    }
  }

  ```

### Стратегия 3: `<span class="selected">SCHEDULE_BASED</span>`

* **Когда использовать?** Для самого распространенного случая: у поставщика есть **фиксированные дни доставки** и **время отсечки (cutoff)** для заказов. Логика всегда такая: 1) Определить, когда товар "готов". 2) Найти следующий доступный день доставки после даты готовности.
* **Ключевые поля:**
  * `<span class="selected">strategy</span>`: Всегда `<span class="selected">'SCHEDULE_BASED'</span>`.
  * `<span class="selected">deliveryWeekdays</span>`: Массив дней недели, когда возможна доставка (например, `<span class="selected">[1, 4]</span>` для Пн и Чт).
  * `<span class="selected">allowSameDayDelivery</span>`: `<span class="selected">true</span>` или `<span class="selected">false</span>`. Если `<span class="selected">false</span>`, то доставка будет минимум на следующий день, даже если сегодня — день доставки.
  * `<span class="selected">readinessCalculation</span>`: Самая важная часть. Определяет, как посчитать "дату готовности" товара.
    * `<span class="selected">type: 'FROM_CUTOFF'</span>`: Простая отсечка.
      * `<span class="selected">cutoffTime</span>`: Время отсечки, например, `<span class="selected">'11:00'</span>`.
      * `<span class="selected">offsetBeforeCutoff</span>`: Что прибавить к дате заказа, если он сделан *до* отсечки (например, `<span class="selected">{ days: 0 }</span>` — готов сегодня).
      * `<span class="selected">offsetAfterCutoff</span>`: Что прибавить, если заказ сделан *после* отсечки (например, `<span class="selected">{ days: 1 }</span>` — готов завтра).
    * `<span class="selected">type: 'PLUS_HOURS_FROM_RESULT'</span>`: Дата готовности = текущее время + `<span class="selected">X</span>` часов из поля `<span class="selected">sourceField</span>` в данных от API.
    * `<span class="selected">type: 'CONDITIONAL_CUTOFF'</span>`: Гибридная логика. Проверяет значение поля `<span class="selected">conditionField</span>` (например, `<span class="selected">deadLineMax</span>`). Если оно > 0, используется логика `<span class="selected">PLUS_HOURS_FROM_RESULT</span>`. Если нет — логика `<span class="selected">FROM_CUTOFF</span>`.
* **Пример (`<span class="selected">ug</span>`):**
  ```
  {
    supplierName: 'ug',
    calculation: {
      strategy: 'SCHEDULE_BASED',
      deliveryWeekdays: [1, 4], // Доставка в Пн, Чт
      allowSameDayDelivery: false,
      readinessCalculation: {
        type: 'CONDITIONAL_CUTOFF',
        conditionField: 'deadLineMax', // Проверяем это поле
        positiveCase: { // Если deadLineMax > 0
          type: 'PLUS_HOURS_FROM_RESULT',
          sourceField: 'deadLineMax',
        },
        negativeCase: { // Если deadLineMax <= 0
          type: 'FROM_CUTOFF',
          cutoffTime: '14:00',
          offsetBeforeCutoff: { days: 1 },
          offsetAfterCutoff: { days: 2 },
        },
      },
    }
  }

  ```

### Стратегия 4: `<span class="selected">SHIPMENT_SCHEDULE_BASED</span>`

* **Когда использовать?** Для самых сложных поставщиков, у которых есть разделение на **день отгрузки** со склада и **день доставки** клиенту.
* **Ключевые поля:**
  * `<span class="selected">strategy</span>`: Всегда `<span class="selected">'SHIPMENT_SCHEDULE_BASED'</span>`.
  * `<span class="selected">readinessCalculation</span>`: Как и в прошлой стратегии, определяет, когда товар готов к рассмотрению на отгрузку. Обычно это `<span class="selected">PLUS_HOURS_FROM_RESULT</span>`.
  * `<span class="selected">shipmentWeekdays</span>`: Дни, когда происходят отгрузки со склада (например, `<span class="selected">[2, 5]</span>` для Вт и Пт).
  * `<span class="selected">shipmentCutoffTime</span>`: Время отсечки в день отгрузки.
  * `<span class="selected">deliveryDelay</span>`: Время, которое проходит от момента отгрузки до доставки клиенту (например, `<span class="selected">{ days: 1 }</span>`).
* **Пример (`<span class="selected">npn</span>`):**
  ```
  {
    supplierName: 'npn',
    calculation: {
      strategy: 'SHIPMENT_SCHEDULE_BASED',
      readinessCalculation: {
        type: 'PLUS_HOURS_FROM_RESULT',
        sourceField: 'deadline',
      },
      shipmentWeekdays: [2, 5], // Отгрузка во Вт, Пт
      shipmentCutoffTime: '15:00', // Отсечка в 15:00
      deliveryDelay: { days: 1 }, // Доставка через день после отгрузки
      avoidDeliveryWeekdays: [7], // Избегать доставки в Вс
    }
  }

  ```

## Пошаговый план: Как добавить нового поставщика

1. **Анализ.** Прочитайте требования или старый код. Ответьте на вопросы:
   * **Дата приходит готовая от API? -> **`<span class="selected">DIRECT_FROM_API</span>`
   * **Логика похожа на "если заказал в понедельник до обеда, то доставка во вторник"? -> **`<span class="selected">RULE_BASED</span>`
   * **Есть ли фиксированные дни доставки и время отсечки? -> **`<span class="selected">SCHEDULE_BASED</span>`
   * **Есть ли отдельные дни отгрузки и задержка до доставки? -> **`<span class="selected">SHIPMENT_SCHEDULE_BASED</span>`
2. **Выбор стратегии.** На основе ответов выберите одну из четырех стратегий.
3. **Откройте `<span class="selected">suppliersConfig.declarative.ts</span>`.**
4. **Создайте новый объект.** Скопируйте похожий конфиг или начните с нуля:
   ```
   {
     supplierName: 'имя-нового-поставщика',
     calculation: {
       strategy: 'ВАША_ВЫБРАННАЯ_СТРАТЕГИЯ',
       // ... начинайте заполнять поля
     }
   }

   ```
5. **Заполните поля.** TypeScript и ваш редактор кода, опираясь на `<span class="selected">types/dateTypes.d.ts</span>`, будут подсказывать вам, какие поля обязательны для этой стратегии. Это ваш главный помощник!
6. **Переиспользуйте!** Посмотрите, нет ли уже готовых базовых конфигов (`<span class="selected">directFromApiBase</span>`, `<span class="selected">ugAndAvtodinamikaBaseConfig</span>`), которые можно использовать, чтобы не дублировать код.

**Готово! Вы только что добавили сложную бизнес-логику, не написав ни строчки исполняемого кода, а лишь описав ее в виде данных.**
