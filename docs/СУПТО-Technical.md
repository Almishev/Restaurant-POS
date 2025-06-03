# Техническа документация за СУПТО сертифициране

## Ресторантска POS система - Техническа спецификация

## Архитектура на системата

### Общ преглед

Системата е реализирана като съвременно уеб приложение, което следва архитектура клиент-сървър:

- **Frontend**: Single Page Application (SPA), разработена с React.js
- **Backend**: REST API сървър, разработен с Node.js и Express.js
- **База данни**: MongoDB за съхранение на структурирани данни

### Компоненти на системата

#### 1. Клиентска част (Frontend)

- **Технологии**: React.js, Redux, Ant Design
- **Основни модули**:
  - Управление на маси (`TablesPage.js`)
  - Поръчки и меню (`Homepage.js`)
  - Кухня/бар интерфейс (`KitchenPage.js`, `BarPage.js`)
  - Сметки и плащания (`CartPage.js`, `BillsPage.js`)
  - Отчети и справки (`ReportsPage.js`, `ReportsArchivePage.js`)
  - Сторно операции (`StornoPage.js`, `StornoListPage.js`, `StornoReportPage.js`)
  - Управление на потребители (`UsersPage.js`)
  - Управление на артикули и категории (`ItemPage.js`, `CategoriesPage.js`)
  - Управление на склада (`InventoryPage.js`, `RecipePage.js`)

#### 2. Сървърна част (Backend)

- **Технологии**: Node.js, Express.js, Mongoose ODM
- **Основни модули**:
  - Управление на потребители (`userRoutes.js`, `userController.js`)
  - Управление на артикули (`itemRoutes.js`, `itemController.js`)
  - Управление на продажби (`billsRoute.js`, `billsController.js`)
  - Сторно операции (`stornoRoute.js`, `stornoController.js`)
  - Фискална интеграция (`fiscalService.js`)
  - Отчетност (`reportModel.js`)
  - Склад и рецепти (`inventoryController.js`, `recipeController.js`)

#### 3. База данни

- **Технология**: MongoDB
- **Основни колекции**:
  - `users` - потребители в системата
  - `items` - артикули и продукти
  - `bills` - сметки и продажби
  - `stornos` - сторно операции
  - `tables` - маси в ресторанта
  - `categories` - категории артикули
  - `kitchenOrders` - поръчки към кухня/бар
  - `inventory` - складови наличности
  - `recipes` - рецепти за артикули
  - `reports` - архивирани отчети (Z отчети)

## Функционалност за спазване на изискванията на Наредба Н-18

### 1. Фискална функционалност

#### Механизъм за връзка с фискално устройство

Системата използва специализиран модул `fiscalService.js` за комуникация с фискалното устройство:

```javascript
// Извадка от fiscalService.js
async printStornoBon(originalBill, stornoId, reason, cartItems) {
  try {
    if (this.isTestMode) {
      // В тестов режим симулираме фискалния процес
      console.log('[FISCAL SERVICE] Printing storno receipt for bill:', originalBill._id);
      // ... тестова логика ...
    } else {
      // Реална интеграция с фискално устройство
      const fiscalData = {
        type: 'storno',
        operator: 1,
        originalReceiptId: originalBill.fiscalReceiptId,
        items: cartItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          vatGroup: 'B',
          department: 1
        })),
        reason: this.mapStornoReasonToFiscalCode(reason),
        payment: originalBill.paymentMode === 'cash' ? 'cash' : 'card',
        stornoReferenceId: stornoId
      };

      // Реална комуникация с фискалното устройство
    }
  } catch (error) {
    console.error('[FISCAL SERVICE] Error printing storno receipt:', error);
    throw error;
  }
}
```

#### Съхранение на фискални данни

Всички фискални данни се съхраняват в съответните модели:

```javascript
// Извадка от модела за сторно операции
const stornoSchema = mongoose.Schema(
  {
    // ... други полета ...
    fiscalReceiptId: {
      type: String,
    },
    fiscalReceiptTimestamp: {
      type: Date,
    },
    fiscalStatus: {
      type: String,
      default: "pending",
      enum: ["pending", "completed", "error"],
    },
    fiscalErrorMessage: {
      type: String,
    },
    originalBillFiscalId: {
      type: String,
    },
  },
  { timestamps: true }
);
```

### 2. Уникална идентификация

Всяка продажба и операция в системата получава уникален идентификатор чрез MongoDB ObjectID. Допълнително всички фискализирани операции получават и уникален фискален идентификатор.

### 3. Защита на данните

#### Непроменимост на данните

След генериране на фискален бон, продажбите не могат да бъдат изтривани или редактирани. Всички корекции се извършват чрез сторно операции, които се съхраняват като отделни записи.

#### Одитна следа

Всички действия в системата се записват с информация за потребителя, времето и естеството на операцията.

#### Контрол на достъпа

Реализирана е строга йерархия на ролите и правата чрез механизъм за автентикация и авторизация:

```javascript
// Извадка от защита на маршрути
export function AdminRoute({ children }) {
  const auth = localStorage.getItem("auth");
  if (auth) {
    const { role } = JSON.parse(auth);
    if (role === "admin") {
      return children;
    } else {
      return <Navigate to="/" />;
    }
  } else {
    return <Navigate to="/login" />;
  }
}
```

### 4. Отчетност и справки

#### Дневни и периодични отчети

Системата поддържа X и Z отчети, които могат да бъдат генерирани от администратори:

```javascript
// Извадка от ReportsPage.js
const handleZReport = async () => {
  if (!dates[0] || !dates[1]) {
    message.error("Избери период!");
    return;
  }
  setLoading(true);
  try {
    const body = {
      from: dates[0].startOf("day").toISOString(),
      to: dates[1].endOf("day").toISOString(),
    };
    if (selectedUser) body.userId = selectedUser;
    const res = await axios.post("/api/bills/create-z-report", body);
    setReport(res.data);
    setIsZ(true);
    message.success("Z отчетът е архивиран успешно!");
  } catch (error) {
    const msg =
      error.response?.data?.message || "Грешка при архивиране на Z отчета!";
    message.error(msg);
  }
  setLoading(false);
};
```

#### Хронология на продажбите

Системата предоставя подробна хронология на всички продажби с възможност за филтриране по различни критерии.

### 5. Сторно операции

Системата поддържа пълна функционалност за сторниране на сметки с документиране на основания съгласно изискванията на Наредба Н-18:

```javascript
// Извадка от stornoController.js
const createStornoController = async (req, res) => {
  try {
    const { stornoData } = req.body;

    // Намиране на оригиналния бон
    const originalBill = await billsModel.findById(stornoData.originalBillId);

    if (!originalBill) {
      return res
        .status(404)
        .json({ message: "Оригиналният бон не е намерен!" });
    }

    // Създаване на сторно запис
    const newStorno = new stornoModel({
      ...stornoData,
      fiscalStatus: "pending",
    });

    await newStorno.save();

    // Интеграция с фискално устройство
    try {
      const fiscalService = require("../services/fiscalService");
      const fiscalResult = await fiscalService.printStornoBon(
        originalBill,
        newStorno._id,
        stornoData.reason,
        stornoData.cartItems
      );

      // Обновяване на сторно документа с фискална информация
      newStorno.fiscalReceiptId = fiscalResult.fiscalReceiptId;
      newStorno.fiscalReceiptTimestamp = fiscalResult.timestamp;
      newStorno.fiscalStatus = "completed";
      await newStorno.save();

      return res.status(201).json({ storno: newStorno, fiscalResult });
    } catch (fiscalError) {
      // Запазваме сторното, но отбелязваме проблем с фискализацията
      newStorno.fiscalStatus = "error";
      newStorno.fiscalErrorMessage =
        fiscalError.message || "Грешка при фискализация";
      await newStorno.save();

      // Връщане на отговор за успешно създаден запис, но с проблем при фискализацията
      return res.status(201).json({
        storno: newStorno,
        fiscalError:
          fiscalError.message || "Неизвестна грешка при фискализация",
        message:
          "Сторно операцията е записана, но има проблем с фискализацията",
      });
    }
  } catch (error) {
    console.error("Грешка при създаване на сторно:", error);
    res
      .status(500)
      .json({ message: "Грешка при създаване на сторно операция" });
  }
};
```

### 6. Интеграция със складова система

Системата поддържа автоматично отписване на артикули от склада при продажба и възстановяване при сторно операции:

```javascript
// Пример за автоматично отписване при продажба
for (const ing of recipe.ingredients) {
  // Намаляваме quantity в склада с ing.quantity * cartItem.quantity
  const inventory = await Inventory.findById(ing.inventory);
  if (inventory) {
    const amountToDeduct = ing.quantity * cartItem.quantity;
    inventory.quantity =
      Math.round((inventory.quantity - amountToDeduct) * 100) / 100;
    inventory.history.push({
      type: "out",
      amount: amountToDeduct,
      user: req.body.userId || "sale",
      note: `Продажба на ${cartItem.name}`,
    });
    await inventory.save();
  }
}
```

## Информационна сигурност

### Защита на достъпа

1. **Автентикация** - система за вход с потребителско име и парола
2. **Авторизация** - проверка на ролята и правата за всяко действие
3. **Сесии** - съхраняване на потребителска сесия с времеви лимит

### Защита на данните

1. **Криптиране** - защита на чувствителни данни (пароли)
2. **Валидация** - проверка на всички входни данни
3. **Защитени маршрути** - контрол на достъпа до API крайни точки

## Технически изисквания

### Хардуерни изисквания

- Процесор: 2GHz или по-бърз
- RAM: минимум 4GB
- Дисково пространство: минимум 10GB
- Мрежа: Стабилна интернет връзка

### Софтуерни изисквания

- Операционна система: Windows 10/11, Linux, macOS
- База данни: MongoDB 4.4 или по-нова
- Node.js: v16 или по-нова
- Уеб браузър: Chrome, Firefox, Edge (последни версии)
- Фискално устройство: Съвместимо с комуникационния протокол на системата

## Инсталация и конфигурация

### Инсталация

1. Клониране на хранилището
2. Инсталиране на зависимости за сървъра: `npm install`
3. Инсталиране на зависимости за клиента: `cd client && npm install`
4. Конфигуриране на MongoDB връзка в `.env` файла
5. Стартиране на сървъра: `npm start`
6. Стартиране на клиента: `cd client && npm start`

### Конфигуриране на фискалната интеграция

1. Актуализиране на `fiscalService.js` с параметрите на конкретното фискално устройство
2. Промяна на `isTestMode` на `false` за преминаване от тестов в реален режим
3. Конфигуриране на IP адрес и порт за връзка с фискалното устройство

---

_Настоящата техническа документация е изготвена за целите на сертифициране на системата като СУПТО съгласно изискванията на Наредба Н-18._
