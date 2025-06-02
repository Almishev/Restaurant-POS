const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    userId: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    verified: {
      type: Boolean,
    },
     role: {
      type: String,
      default: "user",
    },
  },
  { timestamp: true }
);

const Users = mongoose.model("users", userSchema);

module.exports = Users;
