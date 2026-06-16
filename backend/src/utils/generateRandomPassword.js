const crypto = require("crypto");

function generateRandomPassword(length = 10) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$!";
  let password = "";
  const bytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }

  return password;
}

module.exports = generateRandomPassword;