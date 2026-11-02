const itemModel = require("../models/itemModel");

// get items
const getItemController = async (req, res) => {
  try {
    const items = await itemModel.find();
    res.status(200).send(items);
  } catch (error) {
    console.log(error);
  }
};

//add items
const addItemController = async (req, res) => {
  try {
    const newItem = new itemModel(req.body);
    await newItem.save();
    res.status(201).send("Item Created Successfully!");
  } catch (error) {
    res.status(400).json({ message: "error", error });
    console.log(error);
  }
};

//update item
const editItemController = async (req, res) => {
  try {
    const { itemId } = req.body;
    const previous = await itemModel.findById(itemId).lean();
    const updated = await itemModel.findOneAndUpdate({ _id: itemId }, req.body, {
      new: true,
    });
    if (previous && updated && Number(previous.price) !== Number(updated.price)) {
      const { writeAudit } = require("../services/auditService");
      await writeAudit({
        action: "price-change",
        userId: req.authUser?.userId || "",
        userName: req.authUser?.name || "",
        entity: "item",
        entityId: itemId,
        detail: `${previous.name}: ${previous.price} -> ${updated.price}`,
      });
    }

    res.status(201).json("item Updated");
  } catch (error) {
    res.status(400).send(error);
    console.log(error);
  }
};
//delete item
const deleteItemController = async (req, res) => {
  try {
    const { itemId } = req.body;
    console.log(itemId);
    await itemModel.findOneAndDelete({ _id: itemId });
    res.status(200).json("item Deleted");
  } catch (error) {
    res.status(400).send(error);
    console.log(error);
  }
};

module.exports = {
  getItemController,
  addItemController,
  editItemController,
  deleteItemController,
};
