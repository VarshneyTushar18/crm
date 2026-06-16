const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },

  createdBy: { type: mongoose.Schema.ObjectId, ref: 'Admin', autopopulate: true, required: true },
  number: {
    type: Number,
    required: true,
  },
  // Payment date
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
  // Payment amount
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'NA',
    uppercase: true,
    required: true,
  },
  // Payment method
  paymentMode: {
    type: mongoose.Schema.ObjectId,
    ref: 'PaymentMode',
  },
  // Reference number
  ref: {
    type: String,
  },
  description: {
    type: String,
  },
  // Reference to Invoice
  invoice: {
    type: mongoose.Schema.ObjectId,
    ref: 'Invoice',
    required: true,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});
// paymentSchema.plugin(require('mongoose-autopopulate'));
module.exports = mongoose.model('Payment', paymentSchema);
