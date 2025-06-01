const express = require("express");
const {
  loginController,
  registerController,
  getUsersController,
} = require("./../controllers/userController");
const Users = require("../models/userModel");

const router = express.Router();

//routes
//Method - get
router.post("/login", loginController);

//MEthod - POST
router.post("/register", registerController);

// GET всички потребители (за отчети)
router.get("/get-users", getUsersController);

module.exports = router;
