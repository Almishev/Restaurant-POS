const dotenv = require("dotenv");
const connectDb = require("./config/config");
const itemModel = require("./models/itemModel");
const userModel = require("./models/userModel");
const items = require("./utils/data");
require("colors");

dotenv.config();
connectDb();

const DEFAULT_ADMIN = {
  name: "Administrator",
  userId: "admin",
  password: "0000",
  role: "admin",
  verified: true,
};

const STATION_USERS = [
  {
    name: "Бар",
    userId: "bar",
    password: "0000",
    role: "bar",
    verified: true,
  },
  {
    name: "Кухня",
    userId: "kitchen",
    password: "0000",
    role: "kitchen",
    verified: true,
  },
];

const ensureUser = async (user) => {
  const existing = await userModel.findOne({ userId: user.userId });
  if (existing) {
    await userModel.updateOne(
      { userId: user.userId },
      {
        $set: {
          name: user.name,
          password: user.password,
          role: user.role,
          verified: true,
        },
      }
    );
    console.log(`User updated (userId: ${user.userId})`.bgYellow);
  } else {
    await userModel.create(user);
    console.log(
      `User created — userId: ${user.userId} / password: ${user.password} / role: ${user.role}`.bgGreen
    );
  }
};

const ensureDefaultUsers = async () => {
  await ensureUser(DEFAULT_ADMIN);
  for (const user of STATION_USERS) {
    await ensureUser(user);
  }
};

const importData = async () => {
  const usersOnly = process.argv.includes("--users-only");

  try {
    if (!usersOnly) {
      await itemModel.deleteMany();
      await itemModel.insertMany(items);
      console.log("All Items Added".bgGreen);
    }

    await ensureDefaultUsers();

    process.exit(0);
  } catch (error) {
    console.log(`${error}`.bgRed.inverse);
    process.exit(1);
  }
};

importData();
