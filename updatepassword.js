const bcrypt = require('bcrypt');

const newPassword = "tech2globe@089";  // your chosen password
const saltRounds = 10;

bcrypt.hash(newPassword, saltRounds, function(err, hash) {
  if (err) throw err;
  console.log("Hashed password:", hash);
});