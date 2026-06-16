const mongoose = require('mongoose');
const moment = require('moment');

const Model = mongoose.model('Quote');
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

    const statuses = ['draft', 'pending', 'sent', 'expired', 'declined', 'accepted'];

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
          _id: '$status',
          count: {
            $sum: 1,
          },
          total_amount: {
            $sum: '$total',
          },
        },
      },
      {
        $group: {
          _id: null,
          total_count: {
            $sum: '$count',
          },
          results: {
            $push: '$$ROOT',
          },
        },
      },
      {
        $unwind: '$results',
      },
      {
        $project: {
          _id: 0,
          status: '$results._id',
          count: '$results.count',
          percentage: {
            $round: [{ $multiply: [{ $divide: ['$results.count', '$total_count'] }, 100] }, 0],
          },
          total_amount: '$results.total_amount',
        },
      },
      {
        $sort: {
          status: 1,
        },
      },
    ]);

    statuses.forEach((status) => {
      const found = result.find((item) => item.status === status);
      if (!found) {
        result.push({
          status,
          count: 0,
          percentage: 0,
          total_amount: 0,
        });
      }
    });

    const total = result.reduce((acc, item) => acc + item.total_amount, 0);
    
    // Sales Pipeline: Value of quotes issued but not yet accepted/declined/expired
    // Usually 'sent', 'pending', 'draft'
    const pipelineValue = result
      .filter(item => ['sent', 'pending', 'draft'].includes(item.status))
      .reduce((acc, item) => acc + item.total_amount, 0);

    const finalResult = {
      total,
      pipelineValue,
      performance: result,
    };

    return res.status(200).json({
      success: true,
      result: finalResult,
      message: `Successfully fetched the summary of quotes`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      result: null,
      message: 'Error retrieving quote summary',
      error: error.message
    });
  }
};
module.exports = summary;
