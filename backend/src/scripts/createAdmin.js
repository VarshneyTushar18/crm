require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

async function run() {
  await mongoose.connect(process.env.DATABASE);
  const User = mongoose.models.User || require("../models/appModels/User");

  const email = "admin@idurar.com";
  const exists = await User.findOne({ email });

  if (exists) {
    console.log("Admin already exists:", email);
    process.exit(0);
  }

  const hash = await bcrypt.hash("Admin@123", 10);

  await User.create({
    name: "System Admin",
    email,
    password: hash,
    role: "admin",
    isActive: true,
  });

  console.log("✅ Admin created");
  console.log("Email:", email);
  console.log("Password:", "Admin@123");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
