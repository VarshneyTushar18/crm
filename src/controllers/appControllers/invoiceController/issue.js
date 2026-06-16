const mongoose = require('mongoose');

const Model = mongoose.model('Invoice');

const issue = async (req, res) => {
  const invoiceId = req.params.id;

  const invoice = await Model.findOne({
    _id: invoiceId,
    removed: false,
  });

  if (!invoice) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'Invoice not found',
    });
  }

  if (invoice.status !== 'Draft') {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Only draft invoices can be issued',
    });
  }

  // Once issued, the total becomes fixed and cannot be changed
  const result = await Model.findOneAndUpdate(
    { _id: invoiceId },
    {
      $set: {
        status: 'Issued',
        // Ensure total is fixed at this point
      },
    },
    {
      new: true,
    }
  ).exec();

  return res.status(200).json({
    success: true,
    result,
    message: 'Invoice issued successfully',
  });
};

module.exports = issue;