const express = require("express");
const router = express.Router();
const Table = require("../models/tableModel");

// GET всички маси
router.get("/get-tables", async (req, res) => {
  try {
    const tables = await Table.find();
    res.status(200).json(tables);
  } catch (error) {
    res.status(500).json({ message: "Грешка при зареждане на масите." });
  }
});

// POST нова маса
router.post("/add-table", async (req, res) => {
  try {
    const { name, createdBy } = req.body;
    const newTable = new Table({ name, createdBy });
    await newTable.save();
    res.status(201).json({ message: "Масата е добавена успешно!" });
  } catch (error) {
    res.status(400).json({ message: "Грешка при добавяне на маса." });
  }
});

// PUT обнови количката и сумата на маса
router.put("/update-table-cart", async (req, res) => {
  try {
    const { tableId, cartItems, totalAmount } = req.body;
    
    // Ensure each item has a status field
    const itemsWithStatus = cartItems.map(item => {
      if (!item.status) {
        return { ...item, status: "Изпратено" };
      }
      return item;
    });
    
    const updated = await Table.findByIdAndUpdate(
      tableId,
      { cartItems: itemsWithStatus, totalAmount },
      { new: true }
    );
    res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating table cart:", error);
    res.status(400).json({ message: "Грешка при обновяване на масата." });
  }
});

// PUT обнови pendingItems и сумата на маса
router.put("/update-table-pending-items", async (req, res) => {
  try {
    const { tableId, pendingItems, totalAmount } = req.body;
    const updated = await Table.findByIdAndUpdate(
      tableId,
      { pendingItems, totalAmount },
      { new: true }
    );
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: "Грешка при обновяване на поръчката (pendingItems)." });
  }
});

// DELETE маса по id
router.delete("/delete-table/:id", async (req, res) => {
  try {
    await Table.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Масата е изтрита успешно!" });
  } catch (error) {
    res.status(400).json({ message: "Грешка при изтриване на масата!" });
  }
});

// PUT обнови статуса на артикул в количката на маса
router.put("/update-item-status", async (req, res) => {
  try {
    const { tableName, itemName, status } = req.body;
    
    // Намираме масата по име
    const table = await Table.findOne({ name: tableName });
    
    if (!table) {
      return res.status(404).json({ message: "Масата не е намерена!" });
    }
    
    // Обновяваме статуса на артикула
    if (table.cartItems && table.cartItems.length > 0) {
      let itemFound = false;
      
      table.cartItems = table.cartItems.map(item => {
        if (item.name === itemName) {
          itemFound = true;
          return { ...item.toObject(), status };
        }
        return item;
      });
      
      if (!itemFound) {
        return res.status(404).json({ message: "Артикулът не е намерен в количката на тази маса!" });
      }
      
      await table.save();
      
      console.log(`Статусът на артикул "${itemName}" в маса "${tableName}" е обновен на "${status}"`);
      
      return res.status(200).json({
        message: `Статусът на артикул "${itemName}" е обновен на "${status}"`,
        table
      });
    } else {
      return res.status(400).json({ message: "Количката на тази маса е празна!" });
    }
  } catch (error) {
    console.error("Грешка при обновяване на статуса на артикул:", error);
    res.status(400).json({ message: "Грешка при обновяване на статуса на артикул." });
  }
});

// POST прехвърляне на артикули между маси
router.post("/transfer-items", async (req, res) => {
  try {
    const { fromTableId, toTableId, pendingItems, cartItems } = req.body;
    
    // Проверка за задължителни полета
    if (!fromTableId || !toTableId) {
      return res.status(400).json({ message: "Моля, предоставете идентификатори на двете маси!" });
    }

    // Намираме изходната и целевата маси
    const sourceTable = await Table.findById(fromTableId);
    const targetTable = await Table.findById(toTableId);

    if (!sourceTable || !targetTable) {
      return res.status(404).json({ message: "Една или двете маси не са намерени!" });
    }

    // Операции с масите
    let sourceModified = false;
    let targetTableUpdates = {};

    // Обработка на pending артикули
    if (pendingItems && pendingItems.length > 0) {
      // Добавяме към целевата маса
      targetTable.pendingItems = [...(targetTable.pendingItems || []), ...pendingItems];
      
      // Премахваме от изходната маса
      if (sourceTable.pendingItems && sourceTable.pendingItems.length > 0) {
        const pendingItemIds = pendingItems.map(item => item._id);
        sourceTable.pendingItems = sourceTable.pendingItems.filter(
          item => !pendingItemIds.includes(item._id.toString())
        );
        sourceModified = true;
      }
    }

    // Обработка на cart артикули
    if (cartItems && cartItems.length > 0) {
      // Добавяме към целевата маса
      targetTable.cartItems = [...(targetTable.cartItems || []), ...cartItems];
      
      // Премахваме от изходната маса
      if (sourceTable.cartItems && sourceTable.cartItems.length > 0) {
        const cartItemIds = cartItems.map(item => item._id);
        sourceTable.cartItems = sourceTable.cartItems.filter(
          item => !cartItemIds.includes(item._id.toString())
        );
        sourceModified = true;
      }
    }

    // Преизчисляваме сумите за двете маси
    // За целевата маса
    targetTable.totalAmount = [
      ...(targetTable.cartItems || []),
      ...(targetTable.pendingItems || [])
    ].reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // За изходната маса, ако е променена
    if (sourceModified) {
      sourceTable.totalAmount = [
        ...(sourceTable.cartItems || []),
        ...(sourceTable.pendingItems || [])
      ].reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      await sourceTable.save();
    }

    // Запазваме промените в целевата маса
    await targetTable.save();

    res.status(200).json({ 
      message: "Артикулите са прехвърлени успешно!",
      sourceTable,
      targetTable
    });
  } catch (error) {
    console.error("Грешка при прехвърляне на артикули:", error);
    res.status(500).json({ message: "Грешка при прехвърляне на артикули между маси." });
  }
});

// PUT прехвърляне на маса към друг сервитьор
router.put("/transfer-table", async (req, res) => {
  try {
    const { tableId, newUserId } = req.body;
    if (!tableId || !newUserId) {
      return res.status(400).json({ message: "Липсва tableId или newUserId!" });
    }
    const updated = await Table.findByIdAndUpdate(tableId, { createdBy: newUserId }, { new: true });
    if (!updated) {
      return res.status(404).json({ message: "Масата не е намерена!" });
    }
    res.json({ message: "Масата е прехвърлена успешно!", table: updated });
  } catch (error) {
    res.status(500).json({ message: "Грешка при прехвърляне на масата!", error: error.message });
  }
});

module.exports = router;