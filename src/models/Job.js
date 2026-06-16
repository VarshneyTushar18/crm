const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  customerId: {
    type: String,
    required: true,
  },
  workerId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: "assigned",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Legacy mobile worker jobs — must NOT use model name "Job" (CRM uses appModels/Job).
module.exports = mongoose.model("MobileJob", jobSchema);