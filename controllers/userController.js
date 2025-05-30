const userModal = require("../models/userModel");

// login user
const loginController = async (req, res) => {
  try {
    const { userId, password } = req.body;
    const user = await userModal.findOne({ userId, password, verified: true });
    if (user) {
      res.status(200).json({
        name: user.name,
        userId: user.userId
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

module.exports = {
  loginController,
  registerController,
};
