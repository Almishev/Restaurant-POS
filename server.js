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

const MONEY_LOCKED = "Приключена продажба не може да се изтрива или да се променя сумата. Корекцията е само чрез сторно.";

function rejectCompletedSaleChange(req, res, next) {
  if (req.method === "DELETE" || req.method === "PUT" || req.method === "PATCH") {
    return res.status(403).json({ message: MONEY_LOCKED });
  }
  next();
}

app.use("/api/bills", rejectCompletedSaleChange);

const Users = require("./models/userModel");
app.use(async (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (req.path === "/api/users/login") return next();
  const userId = req.headers["x-user-id"];
  if (!userId) return next();
  try {
    const user = await Users.findOne({ userId: String(userId) });
    if (user && user.role === "auditor") {
      return res.status(403).json({ message: "Одиторът има само право на преглед" });
    }
    next();
  } catch (error) {
    next(error);
  }
});

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
  const pkg = require("./package.json");
  res.status(200).json({
    ok: true,
    name: "PirinPixel restaurant",
    version: pkg.version,
  });
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
