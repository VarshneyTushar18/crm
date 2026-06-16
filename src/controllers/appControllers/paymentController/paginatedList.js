const mongoose = require('mongoose');

const Model = mongoose.model('Payment');

const paginatedList = async (req, res) => {
  const page = req.query.page || 1;
  const limit = parseInt(req.query.items) || 10;
  const skip = page * limit - limit;

  const { sortBy = 'enabled', sortValue = -1, filter, equal } = req.query;

  const fieldsArray = req.query.fields ? req.query.fields.split(',') : [];

  let fields;

  fields = fieldsArray.length === 0 ? {} : { $or: [] };

  for (const field of fieldsArray) {
    fields.$or.push({ [field]: { $regex: new RegExp(req.query.q, 'i') } });
  }

  //  Query the database for a list of all results
  const resultsPromise = Model.find({
    removed: false,
    [filter]: equal,
    ...fields,
  })
    .skip(skip)
    .limit(limit)
    .sort({ [sortBy]: sortValue })
    .populate('invoice')
    .populate('paymentMode')
    .exec();

  // Counting the total documents
  const countPromise = Model.countDocuments({
    removed: false,
    [filter]: equal,
    ...fields,
  });

  // Resolving both promises
  const [result, count] = await Promise.all([resultsPromise, countPromise]);
  
  // Calculating total pages
  const pages = Math.ceil(count / limit);

  // Getting Pagination Object
  const pagination = { page, pages, count };
  
  // Custom population for deeper nesting if needed
  // We need to populate job in invoice for the frontend to show customer name
  const populatedResults = await Promise.all(result.map(async (doc) => {
    const populatedDoc = doc.toObject();
    if (populatedDoc.invoice && populatedDoc.invoice.job) {
       populatedDoc.invoice = await mongoose.model('Invoice').populate(doc.invoice, { path: 'job' });
    }
    return populatedDoc;
  }));

  if (count > 0) {
    return res.status(200).json({
      success: true,
      result: populatedResults,
      pagination,
      message: 'Successfully found all documents',
    });
  } else {
    return res.status(203).json({
      success: true,
      result: [],
      pagination,
      message: 'Collection is Empty',
    });
  }
};

module.exports = paginatedList;
