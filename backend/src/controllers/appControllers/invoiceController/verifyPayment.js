const mongoose = require('mongoose');
const Invoice = mongoose.model('Invoice');
const Payment = mongoose.model('Payment');
const Job = mongoose.model('Job');

const verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    const invoice = await Invoice.findOne({ _id: id, removed: false }).populate('job');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    // ─── REJECT ─────────────────────────────────────────────────
    if (action === 'reject') {
      invoice.paymentNotified = false;
      invoice.paymentRef = undefined;
      invoice.paymentMode = undefined;
      invoice.notificationDate = undefined;
      await invoice.save();

      return res.json({
        success: true,
        message: 'Payment notification rejected',
      });
    }

    // ─── APPROVE ────────────────────────────────────────────────
    if (action === 'approve') {
      const paymentAmount = invoice.amountDue;

      if (!paymentAmount || paymentAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invoice has no outstanding balance',
        });
      }

      // 1. Auto-generate next payment number
      const lastPayment = await Payment.findOne().sort({ number: -1 });
      const nextNumber = lastPayment?.number ? lastPayment.number + 1 : 1;

      // 2. Create the Payment record (mirroring paymentController/create.js)
      const createdBy = (req.admin || req.user)?._id;

      const paymentResult = await Payment.create({
        number: nextNumber,
        date: invoice.notificationDate || new Date(),
        amount: paymentAmount,
        currency: invoice.currency || 'INR',
        invoice: invoice._id,
        ref: invoice.paymentRef || '',
        description: `Verified payment for Invoice ${invoice.number}`,
        createdBy,
      });

      // 3. Set PDF file name (to avoid Missing PDF errors)
      await Payment.findByIdAndUpdate(paymentResult._id, {
        pdf: `payment-${paymentResult._id}.pdf`,
      });

      // 4. Update Invoice amounts & status
      const newAmountPaid = invoice.amountPaid + paymentAmount;
      const newAmountDue = invoice.total - newAmountPaid;

      const now = new Date();
      const isOverdue = now > invoice.expiredDate && newAmountDue > 0;
      let newStatus = newAmountDue <= 0 ? 'Paid' : isOverdue ? 'Overdue' : 'Partially Paid';

      await Invoice.findByIdAndUpdate(invoice._id, {
        $push: { payment: paymentResult._id.toString() },
        $set: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newStatus,
          isOverdue: isOverdue,
          paymentNotified: false,
          paymentRef: null,
          paymentMode: null,
          notificationDate: null,
        },
      });

      // 5. Update Job totalPaid
      const job = await Job.findById(invoice.job?._id || invoice.job);
      if (job) {
        job.totalPaid = (job.totalPaid || 0) + paymentAmount;
        await job.save();
      }

      return res.json({
        success: true,
        result: paymentResult,
        message: 'Payment verified and recorded successfully',
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid action. Use "approve" or "reject".',
    });
  } catch (err) {
    console.error('verifyPayment error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = verifyPayment;
