<!-- BEGIN WRAPPED MARKDOWN -->

# Подготовка новой Windows 11 машины

## 1. Установка необходимых программ

### Node.js (LTS)

- **Скачать установщик (LTS) для Windows.**
- **Установить** с настройками по умолчанию, чтобы можно было вызывать `node` и `npm` из командной строки/PowerShell.

### Git

- **Скачать установщик для Windows.**
- **Установить**, выбрав опцию «Git from the command line and also from 3rd-party software».

### (Опционально) VS Code

- **Скачать и установить** для удобного редактирования кода.

### Проверка переменной PATH

В PowerShell выполните:

```bash
node -v
npm -v
git --version
```

и убедитесь, что всё доступно.

---

## 2. Клонирование репозитория и настройка проекта

1. **Открыть PowerShell (или cmd)** и перейти в папку для проектов, например:

   ```bash
   cd D:\projects
   ```

2. **Клонировать репозиторий:**

   ```bash
   git clone <URL_репозитория>
   ```

   Если репозиторий приватный, при запросе логина/пароля введите свои учётные данные или настройте SSH-ключ.
3. **Перейти в папку проекта:**

   ```bash
   cd <название-папки-с-проектом>
   ```

4. **Установить зависимости:**

   ```bash
   npm install
   ```

5. **(При необходимости)** добавить дополнительные пакеты:

   ```bash
   npm install typescript ts-node @types/node --save-dev
   ```

### Проверка TypeScript

- Убедитесь, что в `package.json` присутствует скрипт, например:

  ```json
  "build": "tsc && tsc-alias"
  ```

  или просто `tsc`.
- Выполните:

  ```bash
  npm run build
  ```

  и проверьте, что в папке `dist/` сформировался JavaScript-код.

### Локальный запуск (если требуется)

- Запустить можно командой:

  ```bash
  npm run dev
  ```

  или

  ```bash
  npm run build
  npm start
  ```

- Проверьте работу приложения по адресу:  
  `http://localhost:<port>`

---

## 3. Установка NSSM и настройка служб (для продакшена/автоматического запуска)

### 3.1. Скачивание NSSM

- Перейдите на [nssm.cc/download](https://nssm.cc/download).
- Скачайте ZIP-архив и распакуйте его (например, в `C:\nssm\`).

### 3.2. Создание двух служб (схема «два сервиса»)

Используются два сервиса:

- **Основной сервис:** `pricer-back`
- **Сервис вебхука:** `pricer-back-webhook`

#### (А) Установка сервиса для основного приложения

1. Запустите PowerShell от имени администратора:

   ```bash
   cd C:\nssm
   .\nssm.exe install pricer-back
   ```

2. В окне **NSSM Service Installer** укажите:
   - **Path:** `C:\Program Files\nodejs\node.exe` (или другой путь к Node.js)
   - **Startup directory:** `D:\projects\<folder>` (папка с проектом)
   - **Arguments:** `dist\index.js` (основной файл, слушающий порт, например, 3001)
3. *(Опционально)* На вкладке «I/O» можно указать пути к логам (например, `stdout.log` и `stderr.log`).
4. Нажмите **Install service**.
5. Откройте «Services (Службы)» (Win+R → `services.msc`), найдите `pricer-back` и запустите его.
6. Убедитесь, что приложение запущено и порт прослушивается.

#### (Б) Установка сервиса для вебхука

1. Снова в администраторском PowerShell:

   ```bash
   cd C:\nssm
   .\nssm.exe install pricer-back-webhook
   ```

2. В окне **NSSM Service Installer** укажите:
   - **Path:** тот же `node.exe`
   - **Startup directory:** `D:\projects\<folder>` (та же папка, если файл `webhooks.ts` находится там)
   - **Arguments:** `dist\webhook.js` (файл, слушающий порт 3000)
3. *(Опционально)* Настройте вкладку «I/O» для логирования.
4. Нажмите **Install service** и запустите `pricer-back-webhook`.
5. Теперь сервис принимает Webhook-запросы от GitHub на порту 3000.

---

## 4. Настройка портов и проброса (для доступа извне)

Если компьютер находится за роутером:

- **Определите локальный IP** (через `ipconfig`), например, `192.168.0.50`.
- В настройках роутера (например, TP-Link, D-Link) зайдите в раздел Forwarding / Virtual Server и настройте:
  - Проброс порта **3000** → `192.168.0.50:3000` (для вебхука).
  - Проброс порта **3001** → `192.168.0.50:3001` (для основного приложения).
- Проверьте наличие публичного IP или настройте DDNS при динамическом IP.
- *(Опционально)* Отключите или настройте Windows Firewall, если он блокирует порты `3000/3001`.

---

## 5. Настройка GitHub Webhook (автоматический деплой)

Если в `webhook.ts` прописана команда, например:

```bash
exec('git pull origin main && npm install && npm run build && "C:/nssm/nssm.exe" restart pricer-back', { cwd: 'D:/projects/<folder>' }, ...)
```

то при пуше в GitHub Webhook-сервис (на порту 3000) выполнит деплой и перезапустит `pricer-back`.

Для настройки в репозитории GitHub:

1. Перейдите в **Settings** → **Webhooks** → **Add webhook**.
2. Укажите:
   - **Payload URL:** `http://<ваш_внешний_IP>:3000/webhook`
   - **Content type:** `application/json`
   - **Secret:** тот же, что в `GITHUB_SECRET` (если используется проверка подписи)
   - **Events:** «Just the push event»
3. Сохраните настройки. При тестовом `ping` сервис должен ответить корректно (например, «OK» или сообщением о том, что событие не push).
4. Сделайте commit+push и проверьте раздел «Recent deliveries» (ожидается код ответа `200 OK`).

---

## 6. Подводные камни и советы

### NSSM не найден

- Если внутри `exec(...)` вызываете:

  ```bash
  nssm restart pricer-back
  ```

  укажите полный путь:

  ```bash
  "C:/nssm/nssm.exe" restart pricer-back
  ```

  или добавьте `C:\nssm\` в системный PATH.

### Права доступа

- Служба NSSM обычно работает от имени `Local System`. Убедитесь, что у неё есть доступ к папке проекта для выполнения `git pull`.
- При необходимости настройте права с помощью команды:

  ```bash
  sc config pricer-back-webhook obj= "NT AUTHORITY\SYSTEM"
  ```

  или задайте параметры в свойствах службы (вкладка «Log On»).
- Возможно, потребуется настроить Git для работы с безопасными каталогами:

  ```bash
  git config --global --add safe.directory D:/projects/<folder>
  ```

  *(Для System-аккаунта можно использовать `psexec -s -i cmd`.)*

### Mixed Content (HTTP + HTTPS)

- Если Netlify (HTTPS) обращается к вашему серверу (HTTP), могут возникнуть проблемы. Решается применением SSL-сертификата (например, Let’s Encrypt) или использованием туннеля (ngrok, Cloudflare Tunnel).

### Логирование

- Рекомендуется использовать Winston или перенаправление `stdout/stderr` в NSSM, а затем просматривать логи через `tail -f` (на Linux) или `Get-Content -Wait` (в PowerShell).

### Перезапуск служб

- Если сервис при деплое выполняет `nssm restart <этот_же_сервис>`, он может убить сам себя. Решение – разделить на два сервиса: основной и вебхук, чтобы перезапускался только основной.

### Проверка GitHub Webhook

- В разделе «Recent Deliveries» убедитесь, что запросы возвращают `200 OK`. Если возникает ошибка `500`, проверьте логи на наличие ошибок (например, «pm2/nssm not found», неверная ветка для `git pull`, отсутствие прав или несовпадение подписи).

---

## 7. Итоговые команды (примерный список)

```bash
# 1) Установка Git, Node, (VS Code) – вручную

# 2) Клонирование репозитория (PowerShell или cmd)
git clone https://github.com/<your_repo>.git
cd <repo_name>
npm install

# 3) Компиляция (если требуется)
npm run build

# 4) Установка NSSM (скачать и распаковать)

# 5) Создание службы основного приложения
C:\nssm\nssm.exe install pricer-back
#   - Path: C:\Program Files\nodejs\node.exe
#   - Startup directory: D:\projects\<repo_name>
#   - Arguments: dist\index.js

# 6) Создание службы вебхука
C:\nssm\nssm.exe install pricer-back-webhook
#   - Path: C:\Program Files\nodejs\node.exe
#   - Startup directory: D:\projects\<repo_name>
#   - Arguments: dist\webhook.js

# 7) Запуск служб через UI (services.msc) или
sc start pricer-back
sc start pricer-back-webhook

# 8) Проброс портов в роутере (если требуется)

# 9) Настройка GitHub Webhook
#   - Settings → Webhooks → Add webhook
#   - URL: http://<External_IP>:3000/webhook
#   - Secret: (указать в .env / GITHUB_SECRET)
#   - Events: push
#   - Сохранить и проверить "Recent deliveries"
```

---

## Заключение

Следуя этому чеклисту, вы сможете без проблем развернуть ваше Node.js-приложение на новой Windows 11 машине:

- **Установка Node.js и Git**
- **Клонирование репозитория и установка зависимостей**
- **Компиляция (TypeScript)**
- **Установка NSSM и создание двух служб (приложение + вебхук)**
- **Проброс портов (для внешнего доступа)**
- **Настройка GitHub Webhook для автоматического деплоя**

Это покрывает большинство типичных подводных камней, включая вопросы прав доступа, настройки NSSM и конфигурацию Git (`safe.directory`).

<!-- END WRAPPED MARKDOWN -->
