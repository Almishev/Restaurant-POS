const express = require("express");
const {
  loginController,
  registerController,
} = require("./../controllers/userController");
const Users = require("../models/userModel");

const router = express.Router();

//routes
//Method - get
router.post("/login", loginController);

//MEthod - POST
router.post("/register", registerController);

// POST: set current table for user
router.post("/set-current-table", async (req, res) => {
  try {
    const { userId, tableId } = req.body;
    const user = await Users.findOneAndUpdate(
      { userId },
      { currentTableId: tableId },
      { new: true }
    );
    res.status(200).json({ currentTableId: user.currentTableId });
  } catch (error) {
    res.status(400).json({ message: "Грешка при избор на маса." });
  }
});

// GET: get current table for user
router.get("/get-current-table/:userId", async (req, res) => {
  try {
    const user = await Users.findOne({ userId: req.params.userId });
    res.status(200).json({ currentTableId: user ? user.currentTableId : null });
  } catch (error) {
    res.status(400).json({ message: "Грешка при взимане на маса." });
  }
});

module.exports = router;
