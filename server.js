const path = require("path");
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
app.use('/api/stornos', require("./routes/stornoRoute"));

// Liveness for Docker HEALTHCHECK / load balancers
app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true });
});

// Serve React build only when present (Docker/production). In local dev use CRA on :3000.
const fs = require("fs");
const clientBuildPath = path.join(__dirname, "client", "build");
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientBuildPath, "index.html"), (err) => {
      if (err) next();
    });
  });
}

//port — 0.0.0.0 so Docker / LAN tablets can reach the server
const PORT = process.env.PORT || 8081;
const HOST = process.env.HOST || "0.0.0.0";

//listen
app.listen(PORT, HOST, () => {
  console.log(`Server Running On http://${HOST}:${PORT}`.bgCyan.white);
});
