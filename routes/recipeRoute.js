const express = require('express');
const { getRecipe, createRecipe, updateRecipe, deleteRecipe, getAllRecipes } = require('../controllers/recipeController');
const router = express.Router();

router.get('/:itemId', getRecipe);
router.post('/', createRecipe);
router.put('/:id', updateRecipe);
router.delete('/:id', deleteRecipe);
router.get('/', getAllRecipes);

module.exports = router; 