<!-- BEGIN WRAPPED MARKDOWN -->

# 🚀 NSSM + Git + psexec: Решение проблемы с "dubious ownership" и автозапуском сервиса

## 📌 Описание проблемы

При использовании NSSM для запуска сервиса **Git выдавал ошибку**:

```
fatal: detected dubious ownership in repository at 'D:/projects/pricer-back-ts'
```

**Причина**: NSSM запускал сервис **от имени `NT AUTHORITY\SYSTEM`**, а репозиторий принадлежал пользователю `xboxd`.  
Git блокировал `git pull`, так как считал репозиторий "сомнительным" (**dubious ownership**).  

### 🔍 **Что было сделано для исправления?**

### **1️⃣ Проверили владельца папки и пользователя NSSM**

```shell
icacls D:\projects\pricer-back-ts
sc qc pricer-back
tasklist | findstr node
```

- Убедились, что **репозиторий принадлежит `xboxd`**, а **NSSM работает от `SYSTEM`**.

---

### **2️⃣ Добавили `safe.directory`, но это не помогло**

```shell
git config --global --add safe.directory D:/projects/pricer-back-ts
```

📌 **Git всё равно выдавал ошибку**, потому что `git pull` выполнялся от `SYSTEM`, который использует **свой глобальный конфиг**.

---

### **3️⃣ Добавили `safe.directory` в конфиг `SYSTEM` через psexec**

```shell
psexec -s -i cmd
```

- Это открыло **cmd от имени `SYSTEM`**, и внутри него выполнили:

```shell
git config --global --add safe.directory D:/projects/pricer-back-ts
git config --global --get-all safe.directory
```

📌 Теперь путь появился **в конфиге `SYSTEM`**, и Git перестал выдавать ошибку **dubious ownership**.

---

### **4️⃣ Изменили владельца папки на `SYSTEM` (альтернативное решение)**

```shell
takeown /F D:\projects\pricer-back-ts /R /D Y
icacls D:\projects\pricer-back-ts /grant "NT AUTHORITY\SYSTEM":F /T
```

📌 **Теперь `SYSTEM` владеет папкой**, и Git выполняется без проблем.

---

### **5️⃣ Перезапустили сервис NSSM**

```shell
C:\nssm\nssm.exe restart pricer-back
```

---

## 🔥 **Дополнительная проблема: Служба отключается и не перезапускается**

После фикса **Git-а** NSSM-сервис **падал и не перезапускался**.

### **1️⃣ Проверили статус сервиса**

```shell
nssm status pricer-back
nssm get pricer-back exit
```

📌 Код завершения **≠ 0**, значит, процесс падает.

---

### **2️⃣ Включили автоматический перезапуск в NSSM**

```shell
nssm edit pricer-back
```

- **Вкладка `Exit actions`**:
  - ✅ `Restart service` при ошибке.
  - ✅ `Throttle restart delay` → `5000 мс`.

📌 Теперь NSSM **автоматически перезапускает сервис при падении**.

---

### **3️⃣ Проверили логи сервиса**

```shell
type D:\projects\pricer-back-ts\logs\stderr.log
```

📌 **Ошибок `EADDRINUSE` не было**, значит, проблема не в занятом порте.

---

### **4️⃣ Проверили, запускается ли сервер вручную**

```shell
node D:\projects\pricer-back-ts\dist\server.js
```

📌 **Если сервер падает вручную**, значит, проблема в коде, а не в NSSM.

---

## 🏆 **Итог работы**

✔ Ошибка **dubious ownership** устранена.  
✔ NSSM теперь корректно выполняет `git pull`.  
✔ Включён **автоперезапуск сервиса** в случае краша.  
✔ Деплой и обновление работают стабильно.  

<!-- END WRAPPED MARKDOWN -->
