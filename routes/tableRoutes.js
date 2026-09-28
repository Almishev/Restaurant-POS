const express = require("express");
const router = express.Router();
const Table = require("../models/tableModel");

function toPlainItem(item) {
  if (!item) return null;
  if (typeof item.toObject === "function") return item.toObject();
  return { ...item };
}

/** Merge same product _id into one line (sum quantities). */
function mergeLineItems(items = []) {
  const map = new Map();
  for (const raw of items) {
    const item = toPlainItem(raw);
    if (!item) continue;
    const id = String(item._id ?? item.itemId ?? "");
    if (!id) continue;
    const qty = Number(item.quantity) || 0;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, { ...item, _id: item._id ?? item.itemId, quantity: qty });
      continue;
    }
    const statuses = [existing.status, item.status].filter(Boolean);
    let status = existing.status || item.status;
    if (statuses.length) {
      status = statuses.every((s) => s === "Готово") ? "Готово" : "Изпратено";
    }
    const notes = [existing.note, item.note]
      .map((n) => (n || "").trim())
      .filter(Boolean);
    map.set(id, {
      ...existing,
      ...item,
      _id: existing._id,
      quantity: (Number(existing.quantity) || 0) + qty,
      status,
      note: [...new Set(notes)].join("; "),
    });
  }
  return Array.from(map.values());
}

function lineId(item) {
  return String(item._id ?? item.itemId ?? "");
}

/**
 * Move qty from source list to target list (partial transfer supported).
 * Prefers transferQuantity; falls back to quantity (legacy).
 */
function transferPartial(sourceList, targetList, transferItems) {
  let source = mergeLineItems(sourceList);
  let target = mergeLineItems(targetList);

  for (const t of transferItems || []) {
    const id = lineId(t);
    // Prefer explicit transferQuantity so we never accidentally move the full line stock
    const moveQty = Math.max(
      0,
      Number(
        t.transferQuantity != null ? t.transferQuantity : t.quantity
      ) || 0
    );
    if (!id || moveQty <= 0) continue;

    const srcIdx = source.findIndex((i) => lineId(i) === id);
    if (srcIdx < 0) {
      // Fallback: match by name if _id differs (legacy rows)
      const byName = source.findIndex(
        (i) =>
          (i.name || "").trim().toLowerCase() === (t.name || "").trim().toLowerCase()
      );
      if (byName < 0) continue;
      // use byName path below via reassignment
      const srcItem = source[byName];
      const available = Number(srcItem.quantity) || 0;
      const qty = Math.min(moveQty, available);
      if (qty <= 0) continue;

      if (qty >= available) {
        source.splice(byName, 1);
      } else {
        source[byName] = { ...toPlainItem(srcItem), quantity: available - qty };
      }

      const tgtIdx = target.findIndex(
        (i) =>
          lineId(i) === lineId(srcItem) ||
          (i.name || "").trim().toLowerCase() === (srcItem.name || "").trim().toLowerCase()
      );
      if (tgtIdx >= 0) {
        const tgt = target[tgtIdx];
        target[tgtIdx] = {
          ...toPlainItem(tgt),
          quantity: (Number(tgt.quantity) || 0) + qty,
        };
      } else {
        target.push({
          ...toPlainItem(srcItem),
          quantity: qty,
        });
      }
      continue;
    }

    const srcItem = source[srcIdx];
    const available = Number(srcItem.quantity) || 0;
    const qty = Math.min(moveQty, available);
    if (qty <= 0) continue;

    if (qty >= available) {
      source.splice(srcIdx, 1);
    } else {
      source[srcIdx] = { ...toPlainItem(srcItem), quantity: available - qty };
    }

    const tgtIdx = target.findIndex((i) => lineId(i) === id);
    if (tgtIdx >= 0) {
      const tgt = target[tgtIdx];
      target[tgtIdx] = {
        ...toPlainItem(tgt),
        quantity: (Number(tgt.quantity) || 0) + qty,
        status: tgt.status || srcItem.status || t.status,
        note: tgt.note || srcItem.note || t.note || "",
      };
    } else {
      target.push({
        ...toPlainItem(srcItem),
        quantity: qty,
        status: t.status || srcItem.status,
        note: t.note || srcItem.note || "",
      });
    }
  }

  return {
    source: mergeLineItems(source),
    target: mergeLineItems(target),
  };
}

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
    
    // Ensure each item has a status field, merge duplicate product lines
    const itemsWithStatus = mergeLineItems(cartItems || []).map(item => {
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
      { pendingItems: mergeLineItems(pendingItems || []), totalAmount },
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

// POST прехвърляне на артикули между маси (поддържа частично количество)
router.post("/transfer-items", async (req, res) => {
  try {
    const { fromTableId, toTableId, pendingItems, cartItems } = req.body;
    
    if (!fromTableId || !toTableId) {
      return res.status(400).json({ message: "Моля, предоставете идентификатори на двете маси!" });
    }

    const sourceTable = await Table.findById(fromTableId);
    const targetTable = await Table.findById(toTableId);

    if (!sourceTable || !targetTable) {
      return res.status(404).json({ message: "Една или двете маси не са намерени!" });
    }

    if (pendingItems && pendingItems.length > 0) {
      const result = transferPartial(
        sourceTable.pendingItems || [],
        targetTable.pendingItems || [],
        pendingItems
      );
      sourceTable.pendingItems = result.source;
      targetTable.pendingItems = result.target;
      sourceTable.markModified("pendingItems");
      targetTable.markModified("pendingItems");
    }

    if (cartItems && cartItems.length > 0) {
      const result = transferPartial(
        sourceTable.cartItems || [],
        targetTable.cartItems || [],
        cartItems
      );
      sourceTable.cartItems = result.source;
      targetTable.cartItems = result.target;
      sourceTable.markModified("cartItems");
      targetTable.markModified("cartItems");
    }

    // Collapse any leftover duplicates
    sourceTable.pendingItems = mergeLineItems(sourceTable.pendingItems || []);
    sourceTable.cartItems = mergeLineItems(sourceTable.cartItems || []);
    targetTable.pendingItems = mergeLineItems(targetTable.pendingItems || []);
    targetTable.cartItems = mergeLineItems(targetTable.cartItems || []);
    sourceTable.markModified("pendingItems");
    sourceTable.markModified("cartItems");
    targetTable.markModified("pendingItems");
    targetTable.markModified("cartItems");

    targetTable.totalAmount = [
      ...(targetTable.cartItems || []),
      ...(targetTable.pendingItems || [])
    ].reduce((sum, item) => sum + (item.price * item.quantity), 0);

    sourceTable.totalAmount = [
      ...(sourceTable.cartItems || []),
      ...(sourceTable.pendingItems || [])
    ].reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
    await sourceTable.save();
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

// PUT смяна на име на маса
router.put("/rename-table", async (req, res) => {
  try {
    const { tableId, name } = req.body;
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!tableId || !trimmed) {
      return res.status(400).json({ message: "Липсва tableId или ново име!" });
    }

    const duplicate = await Table.findOne({
      name: trimmed,
      _id: { $ne: tableId },
    });
    if (duplicate) {
      return res.status(400).json({ message: "Вече съществува маса с това име!" });
    }

    const updated = await Table.findByIdAndUpdate(
      tableId,
      { name: trimmed },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Масата не е намерена!" });
    }

    res.json({ message: "Името на масата е променено!", table: updated });
  } catch (error) {
    console.error("Грешка при преименуване на маса:", error);
    res.status(500).json({ message: "Грешка при преименуване на масата!" });
  }
});

module.exports = router;