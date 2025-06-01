const Recipe = require('../models/recipeModel');

// Връща рецепта за дадено ястие
exports.getRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ item: req.params.itemId }).populate('item').populate('ingredients.inventory');
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ message: 'Грешка при зареждане на рецептата', error });
  }
};

// Създава нова рецепта
exports.createRecipe = async (req, res) => {
  try {
    const { item, ingredients } = req.body;
    const recipe = new Recipe({ item, ingredients });
    await recipe.save();
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ message: 'Грешка при създаване на рецепта', error });
  }
};

// Актуализира рецепта
exports.updateRecipe = async (req, res) => {
  try {
    const { ingredients } = req.body;
    const recipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      { ingredients },
      { new: true }
    );
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ message: 'Грешка при редакция на рецепта', error });
  }
};

// Изтрива рецепта
exports.deleteRecipe = async (req, res) => {
  try {
    await Recipe.findByIdAndDelete(req.params.id);
    res.json({ message: 'Рецептата е изтрита' });
  } catch (error) {
    res.status(500).json({ message: 'Грешка при изтриване на рецепта', error });
  }
};

// Връща всички рецепти
exports.getAllRecipes = async (req, res) => {
  try {
    console.log('getAllRecipes: Започва търсене на всички рецепти...');
    const recipes = await Recipe.find()
      .populate('item')
      .populate('ingredients.inventory');
    console.log('getAllRecipes: Намерени рецепти:', recipes.length);
    res.json(recipes);
  } catch (error) {
    console.error('Грешка при getAllRecipes:', error);
    res.status(500).json({ message: 'Грешка при зареждане на рецептите', error });
  }
}; 