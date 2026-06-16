const mongoose = require('mongoose');

const Model = mongoose.model('Payment');
const Invoice = mongoose.model('Invoice');
const Job = mongoose.model('Job');

const remove = async (req, res) => {
  // Find document by id and updates with the required fields
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

  const { _id: paymentId, amount: previousAmount, invoice } = previousPayment;

  // Find the document by id and delete it
  const result = await Model.findOneAndUpdate(
    { _id: req.params.id, removed: false },
    { $set: { removed: true } },
    {
      new: true, // return the new result instead of the old one
    }
  ).exec();

  // Update invoice amounts and status
  let newAmountPaid = invoice.amountPaid - previousAmount;
  let newAmountDue = invoice.total - newAmountPaid;

  // Determine new status
  let newStatus = 'Issued'; // Default back to issued
  if (newAmountDue === 0) {
    newStatus = 'Paid';
  } else if (newAmountDue > 0 && newAmountPaid > 0) {
    newStatus = 'Partially Paid';
  }

  // Check if overdue
  const now = new Date();
  const isOverdue = now > invoice.expiredDate && newAmountDue > 0;
  if (isOverdue) {
    newStatus = 'Overdue';
  }

  const updateInvoice = await Invoice.findOneAndUpdate(
    { _id: invoice._id },
    {
      $pull: {
        payment: paymentId,
      },
      $set: {
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        status: newStatus,
        isOverdue: isOverdue
      },
    },
    {
      new: true, // return the new result instead of the old one
    }
  ).exec();

  // Update job's totalPaid and trigger state calculation
  const updatedJob = await Job.findOne({ _id: invoice.job });
  if (updatedJob) {
    updatedJob.totalPaid -= previousAmount;
    await updatedJob.save();
  }

  return res.status(200).json({
    success: true,
    result,
    message: 'Payment deleted successfully',
  });
};

module.exports = remove;
