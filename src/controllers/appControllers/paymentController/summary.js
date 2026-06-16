const mongoose = require('mongoose');
const moment = require('moment');

const Model = mongoose.model('Payment');
const { loadSettings } = require('@/middlewares/settings');

const getFilterDateRange = (query) => {
  const { type, startDate, endDate } = query;
  let start = moment().startOf('month');
  let end = moment().endOf('month');

  if (type === 'today') {
    start = moment().startOf('day');
    end = moment().endOf('day');
  } else if (type === 'thisWeek') {
    start = moment().startOf('week');
    end = moment().endOf('week');
  } else if (type === 'thisMonth') {
    start = moment().startOf('month');
    end = moment().endOf('month');
  } else if (type === 'custom' && startDate && endDate) {
    start = moment(startDate).startOf('day');
    end = moment(endDate).endOf('day');
  }
  return { start, end };
};

const summary = async (req, res) => {
  try {
    const { start, end } = getFilterDateRange(req.query);

    // get total amount of invoices
    const result = await Model.aggregate([
      {
        $match: {
          removed: false,
          date: {
            $gte: start.toDate(),
            $lte: end.toDate(),
          },
        },
      },
      {
        $group: {
          _id: null, // Group all documents into a single group
          count: {
            $sum: 1,
          },
          total: {
            $sum: '$amount',
          },
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id from the result
          count: 1,
          total: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      result: result.length > 0 ? result[0] : { count: 0, total: 0 },
      message: `Successfully fetched the summary of payments`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      result: null,
      message: 'Error retrieving payment summary',
      error: error.message
    });
  }
};

module.exports = summary;
