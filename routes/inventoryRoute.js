const express = require('express');
const { getInventory, addStock, removeStock } = require('../controllers/inventoryController');
const router = express.Router();

router.get('/', getInventory);
router.post('/in', addStock);
router.post('/out', removeStock);

module.exports = router; 