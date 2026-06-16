const mongoose = require('mongoose');

const Model = mongoose.model('Invoice');
const Job = mongoose.model('Job');

const { calculate } = require('@/helpers');
const { increaseBySettingKey } = require('@/middlewares/settings');
const schema = require('./schemaValidate');

const create = async (req, res) => {
  let body = req.body;

  const { error, value } = schema.validate(body);
  if (error) {
    const { details } = error;
    return res.status(400).json({
      success: false,
      result: null,
      message: details[0]?.message,
    });
  }

  // Validate that job exists
  if (!value.job) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Job is required',
    });
  }
  const job = await Job.findOne({ _id: value.job });
  if (!job) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Job not found',
    });
  }

  // If percentageOfContract is provided, auto-calculate the total
  if (value.percentageOfContract > 0 && job.lockedValue > 0) {
    const calculatedAmount = (job.lockedValue * value.percentageOfContract) / 100;
    body['total'] = calculatedAmount;
    body['subTotal'] = calculatedAmount / (1 + (value.taxRate || 0) / 100);
    body['taxTotal'] = body['total'] - body['subTotal'];
    
    // Create a single item for the progress payment
    body['items'] = [{
      itemName: `${value.invoiceType || 'Progress Payment'} - ${value.percentageOfContract}% of contract`,
      description: `Invoice for ${value.stage || 'project stage'}`,
      quantity: 1,
      price: calculatedAmount,
      total: calculatedAmount,
    }];
  } else if (value.invoiceType === 'Variation' && value.variationId) {
    // Invoicing an existing approved variation
    const variation = job.variations.id(value.variationId);
    if (!variation || variation.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Selected variation is not found or not approved',
      });
    }

    const calculatedAmount = variation.amount;
    body['total'] = calculatedAmount;
    body['subTotal'] = calculatedAmount / (1 + (value.taxRate || 0) / 100);
    body['taxTotal'] = body['total'] - body['subTotal'];
    body['items'] = [
      {
        itemName: `Variation: ${variation.description}`,
        description: `Reference Variation ID: ${variation.jobId || variation._id}`,
        quantity: 1,
        price: calculatedAmount,
        total: calculatedAmount,
      },
    ];
  } else if (value.invoiceType === 'Retention') {
    // Auto-calculate retention if percentage is defined on job
    const retentionPercentage = job.retentionPercentage || 5; // Default to 5% if not set but requested
    const calculatedAmount = (job.lockedValue * retentionPercentage) / 100;
    
    body['total'] = calculatedAmount;
    body['subTotal'] = calculatedAmount / (1 + (value.taxRate || 0) / 100);
    body['taxTotal'] = body['total'] - body['subTotal'];
    body['items'] = [{
      itemName: `Retention Invoice (${retentionPercentage}%)`,
      description: `Retention for job ${job.jobId}`,
      quantity: 1,
      price: calculatedAmount,
      total: calculatedAmount,
    }];
  } else {
    // Manual invoice creation - calculate from items
    const { items = [], taxRate = 0 } = value;

    // default
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
  }

  body['amountDue'] = body['total']; // Initially amount due equals total
  body['createdBy'] = (req.admin || req.user)?._id;

  // Generate unique invoice number
  const currentYear = new Date().getFullYear();
  const lastInvoice = await Model.findOne({ year: currentYear }).sort({ number: -1 });
  let nextNumber = 1;
  if (lastInvoice && lastInvoice.number) {
    const parts = lastInvoice.number.split('-');
    if (parts.length >= 3) {
      const lastNum = parseInt(parts[2] || '0');
      nextNumber = lastNum + 1;
    } else {
      // Fallback if format is unexpected
      const lastNum = parseInt(parts[parts.length - 1] || '0');
      nextNumber = isNaN(lastNum) ? 1 : lastNum + 1;
    }
  }
  body['number'] = `INV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
  body['year'] = currentYear;

  // Creating a new document in the collection
  const result = await new Model(body).save();

  const fileId = 'invoice-' + result._id + '.pdf';
  const updateResult = await Model.findOneAndUpdate(
    { _id: result._id },
    { pdf: fileId },
    {
      new: true,
    }
  ).exec();

  // Update job's totalInvoiced and variations invoicing status
  const jobUpdate = { $inc: { totalInvoiced: result.total } };

  if (value.invoiceType === 'Variation') {
    if (value.variationId) {
      // Mark an existing variation as invoiced
      jobUpdate.$set = {
        'variations.$[elem].invoiceId': result._id,
      };
      // Note: We need to use arrayFilters in findOneAndUpdate
    } else {
      // Legacy/Fallback: Create a new variation entry if none was selected
      jobUpdate.$push = {
        variations: {
          description: value.notes || `Variation Invoice ${body['number']}`,
          amount: result.total,
          status: 'Approved',
          date: result.date || Date.now(),
          invoiceId: result._id,
        },
      };
    }
  }

  const updatedJob = await Job.findOneAndUpdate(
    { _id: job._id },
    jobUpdate,
    value.variationId
      ? {
          new: true,
          arrayFilters: [{ 'elem._id': value.variationId }],
        }
      : { new: true }
  );

  // Trigger pre-save middleware for state calculation (Manual save to trigger middleware)
  await updatedJob.save();

  // Update invoice status based on current state (should be Draft initially)
  // Status will be updated when issued or payments are made

  increaseBySettingKey({
    settingKey: 'last_invoice_number',
  });

  // Returning successfull response
  return res.status(200).json({
    success: true,
    result: updateResult,
    message: 'Invoice created successfully',
  });
};

module.exports = create;
