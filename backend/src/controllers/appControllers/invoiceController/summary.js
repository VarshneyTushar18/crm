const mongoose = require('mongoose');
const moment = require('moment');

const Model = mongoose.model('Invoice');
const Job = mongoose.model('Job');
const Payment = mongoose.model('Payment');

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

    // Filter match object for date
    const dateMatch = {
      removed: false,
      date: {
        $gte: start.toDate(),
        $lte: end.toDate(),
      },
    };

    // Overall metrics for the period
    const invoiceMetrics = await Model.aggregate([
      {
        $match: dateMatch
      },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: '$total' },
          totalUnpaid: {
            $sum: {
              $cond: [
                { $in: ['$status', ['unpaid', 'partially_paid', 'draft', 'pending']] },
                '$amountDue',
                0
              ]
            }
          },
          overdueCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['unpaid', 'partially_paid']] },
                    { $lt: ['$expiredDate', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          },
          overdueValue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['unpaid', 'partially_paid']] },
                    { $lt: ['$expiredDate', new Date()] }
                  ]
                },
                '$amountDue',
                0
              ]
            }
          }
        }
      }
    ]);

    // Invoice status summary for the period
    const invoiceStatusSummary = await Model.aggregate([
      {
        $match: dateMatch
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' },
          totalPaid: { $sum: '$amountPaid' },
          totalDue: { $sum: '$amountDue' }
        }
      },
      {
        $project: {
          _id: 0,
          status: '$_id',
          count: 1,
          totalAmount: 1,
          totalPaid: 1,
          totalDue: 1
        }
      }
    ]);

    const totalCount = invoiceStatusSummary.reduce((sum, item) => sum + item.count, 0);

    const result = {
      totalCount,
      totalInvoiced: invoiceMetrics[0]?.totalInvoiced || 0,
      totalUnpaid: invoiceMetrics[0]?.totalUnpaid || 0,
      overdueInvoicesCount: invoiceMetrics[0]?.overdueCount || 0,
      overdueInvoicesValue: invoiceMetrics[0]?.overdueValue || 0,
      invoiceStatusSummary,
    };

    return res.status(200).json({
      success: true,
      result,
      message: 'Invoice summary retrieved successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      result: null,
      message: 'Error retrieving invoice summary',
      error: error.message
    });
  }
};

module.exports = summary;
