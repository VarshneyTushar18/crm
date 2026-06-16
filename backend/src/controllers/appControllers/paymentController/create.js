const mongoose = require('mongoose');

const Model = mongoose.model('Payment');
const Invoice = mongoose.model('Invoice');
const Job = mongoose.model('Job');

const { calculate } = require('@/helpers');

const create = async (req, res) => {
  // Creating a new document in the collection
  if (req.body.amount === 0) {
    return res.status(202).json({
      success: false,
      result: null,
      message: `The Minimum Amount couldn't be 0`,
    });
  }

  const currentInvoice = await Invoice.findOne({
    _id: req.body.invoice,
    removed: false,
  });

  if (!currentInvoice) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Invoice not found',
    });
  }

  // Check if invoice is issued (only issued invoices can receive payments)
  if (currentInvoice.status === 'Draft') {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Cannot make payment on draft invoice. Invoice must be issued first.',
    });
  }

  const maxAmount = currentInvoice.amountDue;

  if (req.body.amount > maxAmount) {
    return res.status(202).json({
      success: false,
      result: null,
      message: `The Max Amount you can add is ${maxAmount}`,
    });
  }

  req.body['createdBy'] = (req.admin || req.user)?._id;
  
  // Generate unique payment number
  const lastPayment = await Model.findOne().sort({ number: -1 });
  let nextNumber = 1;
  if (lastPayment && lastPayment.number) {
    nextNumber = lastPayment.number + 1;
  }
  req.body['number'] = nextNumber;

  const result = await Model.create(req.body);

  const fileId = 'payment-' + result._id + '.pdf';
  const updatePath = await Model.findOneAndUpdate(
    {
      _id: result._id.toString(),
      removed: false,
    },
    { pdf: fileId },
    {
      new: true,
    }
  ).exec();

  // Update invoice with payment
  const { _id: paymentId, amount } = result;
  const { _id: invoiceId, total, job } = currentInvoice;

  let newAmountPaid = currentInvoice.amountPaid + amount;
  let newAmountDue = total - newAmountPaid;

  // Determine new status
  let newStatus = 'Partially Paid';
  if (newAmountDue === 0) {
    newStatus = 'Paid';
  } else if (newAmountDue > 0 && newAmountPaid > 0) {
    newStatus = 'Partially Paid';
  }

  // Check if overdue
  const now = new Date();
  const isOverdue = now > currentInvoice.expiredDate && newAmountDue > 0;
  if (isOverdue) {
    newStatus = 'Overdue';
  }

  const invoiceUpdate = await Invoice.findOneAndUpdate(
    { _id: invoiceId },
    {
      $push: { payment: paymentId.toString() },
      $set: {
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        status: newStatus,
        isOverdue: isOverdue
      },
    },
    {
      new: true, // return the new result instead of the old one
      runValidators: true,
    }
  ).exec();

  // Update job's totalPaid and trigger state calculation
  const updatedJob = await Job.findOne({ _id: job });
  if (updatedJob) {
    updatedJob.totalPaid += amount;
    await updatedJob.save();
  }

  return res.status(200).json({
    success: true,
    result: updatePath,
    message: 'Payment created successfully',
  });
};

module.exports = create;
