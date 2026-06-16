const mongoose = require('mongoose');

const Model = mongoose.model('Payment');
const Invoice = mongoose.model('Invoice');
const Job = mongoose.model('Job');

const { calculate } = require('@/helpers');

const update = async (req, res) => {
  if (req.body.amount === 0) {
    return res.status(202).json({
      success: false,
      result: null,
      message: `The Minimum Amount couldn't be 0`,
    });
  }

  // Find document by id and populate invoice
  const previousPayment = await Model.findOne({
    _id: req.params.id,
    removed: false,
  }).populate('invoice');

  if (!previousPayment) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'Payment not found',
    });
  }

  const { amount: previousAmount, invoice } = previousPayment;
  const { amount: currentAmount } = req.body;

  const changedAmount = calculate.sub(currentAmount, previousAmount);
  
  // Calculate max possible payment (including the previous amount of this payment)
  const maxAvailable = invoice.amountDue + previousAmount;

  if (currentAmount > maxAvailable) {
    return res.status(400).json({
      success: false,
      result: null,
      message: `The Max Amount you can add is ${maxAvailable}`,
    });
  }

  // Update payment document
  const updates = {
    date: req.body.date,
    amount: currentAmount,
    paymentMode: req.body.paymentMode,
    ref: req.body.ref,
    description: req.body.description,
    currency: req.body.currency || previousPayment.currency,
    updated: new Date(),
  };

  const result = await Model.findOneAndUpdate(
    { _id: req.params.id, removed: false },
    { $set: updates },
    { new: true }
  ).exec();

  // Update invoice amounts and status
  let newAmountPaid = invoice.amountPaid + changedAmount;
  let newAmountDue = invoice.total - newAmountPaid;

  // Determine new status
  let newStatus = 'Partially Paid';
  if (newAmountDue === 0) {
    newStatus = 'Paid';
  } else if (newAmountDue > 0 && newAmountPaid > 0) {
    newStatus = 'Partially Paid';
  } else if (newAmountPaid === 0) {
    newStatus = 'Issued';
  }

  // Check if overdue
  const now = new Date();
  const isOverdue = now > invoice.expiredDate && newAmountDue > 0;
  if (isOverdue) {
    newStatus = 'Overdue';
  }

  await Invoice.findOneAndUpdate(
    { _id: invoice._id },
    {
      $set: {
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        status: newStatus,
        isOverdue: isOverdue
      },
    }
  ).exec();

  // Update job's totalPaid and trigger state calculation
  const updatedJob = await Job.findOne({ _id: invoice.job });
  if (updatedJob) {
    updatedJob.totalPaid += changedAmount;
    await updatedJob.save();
  }

  return res.status(200).json({
    success: true,
    result,
    message: 'Payment updated successfully',
  });
};

module.exports = update;
