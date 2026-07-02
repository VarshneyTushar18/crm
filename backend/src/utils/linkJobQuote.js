const mongoose = require("mongoose");

const Quote = () => mongoose.models.Quote;

/**
 * Links a job to its quote (bidirectional) when a job is created.
 * Prefers explicit quoteId, otherwise finds the latest quote for the lead.
 */
async function linkJobToQuote({ job, quoteId, leadId }) {
  const QuoteModel = Quote();
  if (!QuoteModel || !job?._id) return null;

  let quote = null;

  if (quoteId) {
    quote = await QuoteModel.findById(quoteId);
  } else if (leadId || job.leadId) {
    quote = await QuoteModel.findOne({
      leadId: leadId || job.leadId,
      $or: [{ removed: { $exists: false } }, { removed: false }],
    }).sort({ createdAt: -1 });
  }

  if (!quote) return null;

  const Job = mongoose.models.Job;
  if (Job && !job.quoteId) {
    await Job.findByIdAndUpdate(job._id, { $set: { quoteId: quote._id } });
    job.quoteId = quote._id;
  }

  const quoteUpdate = {};
  if (!quote.jobId) quoteUpdate.jobId = job._id;
  if (job.customerId && !quote.customerId) quoteUpdate.customerId = job.customerId;
  if (job.lockedValue && !quote.totalAmount) quoteUpdate.totalAmount = job.lockedValue;

  if (Object.keys(quoteUpdate).length) {
    quote = await QuoteModel.findByIdAndUpdate(
      quote._id,
      { $set: quoteUpdate },
      { new: true }
    );
  }

  return quote;
}

const sanitizeQuoteForPortal = (quote, jobMap = {}) => {
  if (!quote) return null;
  const obj = quote.toObject ? quote.toObject() : { ...quote };
  const job = obj.jobId ? jobMap[String(obj.jobId._id || obj.jobId)] : null;

  return {
    _id: obj._id,
    quoteNumber: obj.quoteNumber,
    jobId: obj.jobId?._id || obj.jobId,
    jobCode: job?.jobId || null,
    customerName: obj.customerName,
    contactPerson: obj.contactPerson,
    siteAddress: obj.siteAddress,
    scope: obj.scope,
    inclusions: obj.inclusions,
    exclusions: obj.exclusions,
    assumptions: obj.assumptions,
    totalAmount: obj.totalAmount,
    validUntil: obj.validUntil,
    status: obj.status,
    categoryCode: obj.categoryCode,
    materialCode: obj.materialCode,
    version: obj.version,
    approvedAt: obj.approvedAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

module.exports = { linkJobToQuote, sanitizeQuoteForPortal };
