const mongoose = require('mongoose');

const Model = mongoose.model('Invoice');
const ModelPayment = mongoose.model('Payment');
const Job = mongoose.model('Job');

const remove = async (req, res) => {
  const invoice = await Model.findOne({
    _id: req.params.id,
    removed: false,
  });

  if (!invoice) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'Invoice not found',
    });
  }

  // Prevent removing issued invoices
  if (invoice.status !== 'Draft') {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Cannot delete issued invoice. Only draft invoices can be deleted.',
    });
  }

  const deletedInvoice = await Model.findOneAndUpdate(
    {
      _id: req.params.id,
      removed: false,
    },
    {
      $set: {
        removed: true,
      },
    }
  ).exec();

  // Remove associated payments
  const paymentsInvoices = await ModelPayment.updateMany(
    { invoice: deletedInvoice._id },
    { $set: { removed: true } }
  );

  // Update job totals and trigger state calculation
  const updatedJob = await Job.findOne({ _id: invoice.job });
  if (updatedJob) {
    updatedJob.totalInvoiced -= invoice.total;
    updatedJob.totalPaid -= invoice.amountPaid;
    await updatedJob.save();
  }

  return res.status(200).json({
    success: true,
    result: deletedInvoice,
    message: 'Invoice deleted successfully',
  });
};

module.exports = remove;
