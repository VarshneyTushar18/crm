const mongoose = require('mongoose');

const Model = mongoose.model('Invoice');
const Job = mongoose.model('Job');

const { calculate } = require('../../../helpers');
const schema = require('./schemaValidate');

const update = async (req, res) => {
  let body = req.body;

  // Remove status from body if present - status is system controlled
  if (body.status) {
    delete body.status;
  }

  const previousInvoice = await Model.findOne({
    _id: req.params.id,
    removed: false,
  });

  if (!previousInvoice) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'Invoice not found',
    });
  }

  // If invoice is issued, prevent changes to total
  if (previousInvoice.status !== 'Draft') {
    // Only allow updates to certain fields for issued invoices
    const allowedFields = ['notes', 'files'];
    const bodyKeys = Object.keys(body);
    const hasDisallowedFields = bodyKeys.some(key => !allowedFields.includes(key));
    
    if (hasDisallowedFields) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Cannot modify issued invoice totals or items. Only notes and files can be updated.',
      });
    }
  }

  // For draft invoices, allow full updates
  if (previousInvoice.status === 'Draft') {
    const { error, value } = schema.validate(body);
    if (error) {
      const { details } = error;
      return res.status(400).json({
        success: false,
        result: null,
        message: details[0]?.message,
      });
    }

    const { items = [], taxRate = 0 } = req.body;

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Items cannot be empty',
      });
    }

    // Recalculate totals
    let subTotal = 0;
    let taxTotal = 0;
    let total = 0;

    //Calculate the items array with subTotal, total, taxTotal
    items.map((item) => {
      let total = calculate.multiply(item['quantity'], item['price']);
      //sub total
      subTotal = calculate.add(subTotal, total);
      //item total
      item['total'] = total;
    });
    taxTotal = calculate.multiply(subTotal, taxRate / 100);
    total = calculate.add(subTotal, taxTotal);

    body['subTotal'] = subTotal;
    body['taxTotal'] = taxTotal;
    body['total'] = total;
    body['items'] = items;
    body['amountDue'] = total - previousInvoice.amountPaid; // Recalculate amount due
    body['pdf'] = 'invoice-' + req.params.id + '.pdf';

    // Update job's totalInvoiced if total changed and trigger state calculation
    const totalDifference = total - previousInvoice.total;
    if (totalDifference !== 0) {
      const updatedJob = await Job.findOne({ _id: previousInvoice.job });
      if (updatedJob) {
        updatedJob.totalInvoiced += totalDifference;
        await updatedJob.save();
      }
    }
  }

  // Find document by id and updates with the required fields
  const result = await Model.findOneAndUpdate({ _id: req.params.id, removed: false }, body, {
    new: true, // return the new result instead of the old one
  }).exec();

  // Returning successfull response
  return res.status(200).json({
    success: true,
    result,
    message: 'Invoice updated successfully',
  });
};

module.exports = update;
