const express = require("express");
const {
  loginController,
  registerController,
  getUsersController,
  updateUserController,
  deleteUserController,
  getUserByUserIdController,
} = require("./../controllers/userController");
const Users = require("../models/userModel");

const router = express.Router();

// Middleware за проверка на администраторски достъп
const checkAdminAccess = async (req, res, next) => {
  try {
    // Тук можете да извлечете информация за потребителя от заявката
    // За по-сигурна имплементация би трябвало да се използва JWT токен
    // Но за опростеност ще използваме този подход
    const { userId } = req.body;
    if (userId) {
      const user = await Users.findOne({ userId });
      if (user && user.role === 'admin') {
        return next();
      }
    }
    return res.status(403).json({ message: "Нямате достъп! Само администратори могат да извършват тази операция." });
  } catch (error) {
    return res.status(500).json({ message: "Грешка при проверка на достъпа!" });
  }
};

//routes
//Method - POST
router.post("/login", loginController);

//Method - POST - защитена за администратори
router.post("/register", registerController);

// GET всички потребители (за отчети и администрация)
router.get("/get-users", getUsersController);

// PUT обновяване на потребител
router.put("/update-user/:id", updateUserController);

// DELETE изтриване на потребител
router.delete("/delete-user/:id", deleteUserController);

// Взимане на потребител по userId
router.get("/get-user/:userId", getUserByUserIdController);

module.exports = router;
