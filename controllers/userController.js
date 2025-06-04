const userModal = require("../models/userModel");

// login user
const loginController = async (req, res) => {
  try {
    const { userId, password } = req.body;
    const user = await userModal.findOne({ userId, password, verified: true });
    if (user) {
      res.status(200).json({
        name: user.name,
        userId: user.userId,
        role: user.role
      });
    } else {
      res.status(400).json({
        message: "Грешка при вход",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Възникна грешка при вход",
    });
  }
};

//register
const registerController = async (req, res) => {
  console.log("[REGISTER] Получена заявка с body:", req.body);
  try {
    const newUser = new userModal({ ...req.body, verified: true });
    console.log("[REGISTER] Създаден нов user обект:", newUser);
    await newUser.save();
    console.log("[REGISTER] User успешно записан в базата!");
    res.status(201).send("new User added Successfully!");
  } catch (error) {
    console.log("[REGISTER] Грешка при регистрация:", error);
    res.status(400).json({ error: error.message });
  }
};

// Връща всички потребители (за отчети и администрация)
const getUsersController = async (req, res) => {
  try {
    const users = await userModal.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Грешка при зареждане на потребителите!" });
  }
};

// Актуализация на потребител
const updateUserController = async (req, res) => {
  try {
    const { id } = req.params;
    await userModal.findByIdAndUpdate(id, req.body);
    res.status(200).json({ message: "Потребителят е обновен успешно!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Грешка при обновяване на потребителя!" });
  }
};

// Изтриване на потребител
const deleteUserController = async (req, res) => {
  try {
    const { id } = req.params;
    await userModal.findByIdAndDelete(id);
    res.status(200).json({ message: "Потребителят е изтрит успешно!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Грешка при изтриване на потребителя!" });
  }
};

// Връща потребител по userId
const getUserByUserIdController = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await userModal.findOne({ userId });
    if (user) {
      res.status(200).json({
        name: user.name,
        userId: user.userId,
        role: user.role
      });
    } else {
      res.status(404).json({ message: "Потребителят не е намерен!" });
    }
  } catch (error) {
    res.status(500).json({ message: "Грешка при търсене на потребителя!" });
  }
};

module.exports = {
  loginController,
  registerController,
  getUsersController,
  updateUserController,
  deleteUserController,
  getUserByUserIdController,
};
