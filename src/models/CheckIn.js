const mongoose = require("mongoose");

const checkinSchema = new mongoose.Schema({
  workerId: {
    type: String,
    required: true,
  },
  jobId: {
    type: String,
    required: true,
  },
  checkInTime: {
    type: Date,
    default: Date.now,
  },
  checkOutTime: {
    type: Date,
  },
  status: {
    type: String,
    default: "checked_in",
  },
});

module.exports = mongoose.model("CheckIn", checkinSchema);