const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotanv = require("dotenv");
const { bgCyan } = require("colors");
require("colors");
const connectDb = require("./config/config");
const inventoryRoute = require('./routes/inventoryRoute');
const recipeRoute = require('./routes/recipeRoute');
//dotenv config
dotanv.config();
//db config
connectDb();
//rest object
const app = express();

//middlwares
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan("dev"));

//routes
app.use("/api/items", require("./routes/itemRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/bills", require("./routes/billsRoute"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/tables", require("./routes/tableRoutes"));
app.use("/api/kitchen", require("./routes/kitchenRoutes"));
app.use('/api/inventory', inventoryRoute);
app.use('/api/recipes', recipeRoute);

//port
const PORT = process.env.PORT || 8081;

//listen
app.listen(PORT, () => {
  console.log(`Server Running On Port ${PORT}`.bgCyan.white);
});
