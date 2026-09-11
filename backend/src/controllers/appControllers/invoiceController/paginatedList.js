const mongoose = require('mongoose');

const Model = mongoose.model('Invoice');

const paginatedList = async (req, res) => {
  const page = req.query.page || 1;
  const limit = parseInt(req.query.items) || 10;
  const skip = page * limit - limit;

  const { sortBy = 'enabled', sortValue = -1, filter, equal, status } = req.query;

  const fieldsArray = req.query.fields ? req.query.fields.split(',') : [];

  let fields;

  fields = fieldsArray.length === 0 ? {} : { $or: [] };

  for (const field of fieldsArray) {
    fields.$or.push({ [field]: { $regex: new RegExp(req.query.q, 'i') } });
  }

  const query = {
    removed: false,
    ...fields,
  };

  // Optional generic field filter (e.g. job id from search)
  if (filter && equal !== undefined && equal !== '' && filter !== 'undefined') {
    query[filter] = equal;
  }

  // Optional status filter (Draft | Issued | Partially Paid | Paid | Overdue)
  if (status && status !== 'All') {
    query.status = status;
  }

  //  Query the database for a list of all results
  const resultsPromise = Model.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ [sortBy]: sortValue })
    .populate('createdBy', 'name')
    .populate('job')
    .exec();

  // Counting the total documents
  const countPromise = Model.countDocuments(query);

  // Resolving both promises
  const [result, count] = await Promise.all([resultsPromise, countPromise]);
  // Calculating total pages
  const pages = Math.ceil(count / limit);

  // Getting Pagination Object
  const pagination = { page, pages, count };
  if (count > 0) {
    return res.status(200).json({
      success: true,
      result,
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
