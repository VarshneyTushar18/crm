const Joi = require('joi');

const schema = Joi.object({
  job: Joi.alternatives().try(Joi.string(), Joi.object()),

  number: Joi.string().allow(''),
  year: Joi.number().allow(null, ''),

  status: Joi.string()
    .valid('Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue')
    .default('Draft'),

  invoiceType: Joi.string()
    .valid('Progress Payment', 'Variation', 'Final', 'Retention')
    .default('Progress Payment'),

  stage: Joi.string()
    .valid(
      'siteMeasurement',
      'drafting',
      'clientApproval',
      'materialPurchasing',
      'fabrication',
      'finishing',
      'installation',
      'jobCompletion'
    )
    .allow(''),

  percentageOfContract: Joi.number().min(0).max(100).default(0),

  variationId: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow(''),

  expiredDate: Joi.date().required(),
  date: Joi.date().required(),

  // array can be empty for percentage-based invoices
  items: Joi.array()
    .items(
      Joi.object({
        _id: Joi.string().allow('').optional(),
        itemName: Joi.string().required(),
        description: Joi.string().allow(''),
        quantity: Joi.number().required(),
        price: Joi.number().required(),
        total: Joi.number().required(),
      })
    )
    .default([]),

  taxRate: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  currency: Joi.string().required(),
  subTotal: Joi.number().optional(),
  taxTotal: Joi.number().optional(),
  total: Joi.number().optional(),
});

module.exports = schema;