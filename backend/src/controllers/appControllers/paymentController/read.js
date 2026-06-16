const mongoose = require('mongoose');

const Model = mongoose.model('Payment');

const read = async (req, res) => {
  // Find document by id
  const result = await Model.findOne({
    _id: req.params.id,
    removed: false,
  })
    .populate('invoice')
    .populate('paymentMode')
    .populate('createdBy', 'name')
    .exec();
    
  // If no results found, return document not found
  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  } else {
    // Custom population for deeper nesting if needed
    const populatedResult = result.toObject();
    if (populatedResult.invoice && populatedResult.invoice.job) {
       populatedResult.invoice = await mongoose.model('Invoice').populate(result.invoice, { path: 'job' });
    }

    // Return success resposne
    return res.status(200).json({
      success: true,
      result: populatedResult,
      message: 'we found this document ',
    });
  }
};

module.exports = read;
