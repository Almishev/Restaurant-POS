const express = require("express");
const router = express.Router();
const KitchenOrder = require("../models/kitchenOrderModel");
const Item = require("../models/itemModel");

// POST: изпращане на поръчка към кухнята
router.post("/send-order", async (req, res) => {
  try {
    const { tableName, items, waiterName } = req.body;
    console.log("[KITCHEN] Получена поръчка:", { tableName, items, waiterName });
    // За всеки item, ако няма department, вземи го от базата
    const itemsWithDepartment = await Promise.all(items.map(async (item) => {
      if (item.department) {
        console.log(`[KITCHEN] Артикул ${item.name} има department: ${item.department}`);
        return item;
      }
      const dbItem = await Item.findById(item._id);
      console.log(`[KITCHEN] Търся department за ${item.name} (_id: ${item._id}):`, dbItem ? dbItem.department : 'NOT FOUND');
      return { ...item, department: dbItem ? dbItem.department : undefined };
    }));
    console.log("[KITCHEN] Артикули с department, които ще се запишат:", itemsWithDepartment);
    const newOrder = new KitchenOrder({ tableName, items: itemsWithDepartment, waiterName });
    await newOrder.save();
    console.log("[KITCHEN] Поръчката е записана успешно!", newOrder);
    res.status(201).json({ message: "Поръчката е изпратена към кухнята!" });
  } catch (error) {
    console.log("[KITCHEN] Грешка при изпращане на поръчка:", error);
    res.status(400).json({ message: "Грешка при изпращане на поръчка!" });
  }
});

// GET: всички кухненски поръчки
router.get("/orders", async (req, res) => {
  try {
    const orders = await KitchenOrder.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(400).json({ message: "Грешка при зареждане на поръчките!" });
  }
});

// DELETE: изтриване на кухненска поръчка по id
router.delete("/orders/:id", async (req, res) => {
  try {
    await KitchenOrder.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Поръчката е изтрита успешно!" });
  } catch (error) {
    res.status(400).json({ message: "Грешка при изтриване на поръчката!" });
  }
});

// PUT: отбелязване на артикул като готов (done)
router.put("/orders/:id/done", async (req, res) => {
  try {
    const { itemName } = req.body;
    const order = await KitchenOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Поръчката не е намерена!" });
    
    // Обновяваме статуса на артикула
    order.items = order.items.map(item =>
      item.name === itemName ? { ...item.toObject(), done: true } : item
    );
    await order.save();      // Обновяване на статуса и в таблицата
    try {
      // Директно обновяваме таблицата без да правим заявка
      const Table = require("../models/tableModel");
      const table = await Table.findOne({ name: order.tableName });
      
      if (table && table.cartItems && table.cartItems.length > 0) {      // Обновяваме статуса на артикула в cartItems на масата
        table.cartItems = table.cartItems.map(item => {      // Отпечатваме текущия статус на този артикул
          console.log(`[KITCHEN] Артикул: ${item.name}, Текущ статус: ${item.status || 'няма статус'}, Търсено име: ${itemName}`);
          
          // Нормализираме имената за сравнение (премахваме интервали и правим всичко малки букви)
          const normalizedItemName = item.name.toLowerCase().trim();
          const normalizedSearchName = itemName.toLowerCase().trim();
          
          // Проверяваме дали артикулът е "Цезар" и отпечатваме допълнителна информация
          if (normalizedItemName.includes("цезар")) {
            console.log(`[KITCHEN] Намерен артикул Цезар: ${JSON.stringify(item)}`);
            // Ако статусът е undefined или null, добавяме го
            if (!item.status) {
              item.status = "Изпратено";
            }
          }
          
          // Правим сравнение с нормализираните имена
          if (normalizedItemName === normalizedSearchName || item.name === itemName) {
            // Проверка дали item e Mongoose документ или обикновен обект
            const updatedItem = typeof item.toObject === 'function' ? 
              { ...item.toObject(), status: "Готово" } : 
              { ...item, status: "Готово" };
            
            console.log(`[KITCHEN] Променям статус на "${itemName}" на "Готово"`);
            return updatedItem;
          }
          return item;
        });
        
        await table.save();
        console.log(`[KITCHEN] Статусът на артикул ${itemName} е обновен на "Готово" за маса ${order.tableName}`);
      } else {
        console.log(`[KITCHEN] Не намерих артикул ${itemName} в cartItems на маса ${order.tableName}`);
      }
    } catch (tableError) {
      console.error("Грешка при обновяване на статуса в масата:", tableError);
    }
    
    // Ако всички артикули са done, изтрий поръчката
    if (order.items.every(i => i.done)) {
      await KitchenOrder.findByIdAndDelete(req.params.id);
    }
    
    res.status(200).json({ message: "Артикулът е отбелязан като готов!" });
  } catch (error) {
    console.error("Грешка при отбелязване на артикул като готов:", error);
    res.status(400).json({ message: "Грешка при отбелязване на артикул като готов!" });
  }
});

module.exports = router; 