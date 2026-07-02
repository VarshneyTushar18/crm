const mongoose = require("mongoose");
const Rfq = mongoose.model("Rfq");
const PurchaseOrder = mongoose.model("PurchaseOrder");
const Job = mongoose.model("Job");

exports.listRfqs = async (req, res) => {
  try {
    const filter = req.query.jobId ? { jobId: req.query.jobId } : {};
    const result = await Rfq.find(filter)
      .populate("supplierIds", "name email phone")
      .populate("jobId", "jobId customer site")
      .sort({ createdAt: -1 });
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.createRfq = async (req, res) => {
  try {
    if (!req.body.jobId) {
      return res.status(400).json({ success: false, message: "jobId is required" });
    }
    const result = await Rfq.create(req.body);

    if (result.supplierIds?.length && !result.vendorQuotes?.length) {
      result.vendorQuotes = result.supplierIds.map((supplierId) => ({
        supplierId,
        quotedAmount: 0,
        notes: "",
      }));
      await result.save();
    }

    return res.status(201).json({ success: true, result, message: "RFQ created" });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

exports.updateRfq = async (req, res) => {
  try {
    const result = await Rfq.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!result) return res.status(404).json({ success: false, message: "RFQ not found" });
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

exports.sendRfq = async (req, res) => {
  try {
    const rfq = await Rfq.findById(req.params.id);
    if (!rfq) return res.status(404).json({ success: false, message: "RFQ not found" });
    if (!rfq.supplierIds?.length) {
      return res.status(400).json({ success: false, message: "Add at least one supplier" });
    }
    rfq.status = "Sent";
    rfq.sentAt = new Date();
    await rfq.save();
    return res.json({
      success: true,
      result: rfq,
      message: `RFQ sent to ${rfq.supplierIds.length} vendor(s)`,
    });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

exports.awardRfq = async (req, res) => {
  try {
    const { vendorQuoteId, purchaseOrderLines = [] } = req.body;
    const rfq = await Rfq.findById(req.params.id);
    if (!rfq) return res.status(404).json({ success: false, message: "RFQ not found" });

    const quote = rfq.vendorQuotes.id(vendorQuoteId);
    if (!quote) {
      return res.status(400).json({ success: false, message: "Vendor quote not found" });
    }

    rfq.vendorQuotes.forEach((vq) => {
      vq.isSelected = String(vq._id) === String(vendorQuoteId);
    });
    rfq.status = "Awarded";
    await rfq.save();

    const po = await PurchaseOrder.create({
      jobId: rfq.jobId,
      supplierId: quote.supplierId,
      rfqId: rfq._id,
      selectedQuotationRef: quote.documentUrl || quote.notes || "",
      lines: purchaseOrderLines.length
        ? purchaseOrderLines
        : rfq.items.map((item) => ({
            itemName: item.itemName,
            orderedQty: item.quantity,
            receivedQty: 0,
            unit: item.unit,
            unitPrice: 0,
          })),
      status: "Ordered",
    });

    const job = await Job.findById(rfq.jobId);
    if (job) {
      if (!job.workflowEvents) job.workflowEvents = {};
      if (!job.workflowEvents.materialPurchasing) {
        job.workflowEvents.materialPurchasing = {};
      }
      job.workflowEvents.materialPurchasing.selectedSupplierId = quote.supplierId;
      job.workflowEvents.materialPurchasing.selectedQuotationRef =
        quote.documentUrl || quote.notes || "";
      job.markModified("workflowEvents");
      await job.save();
    }

    return res.json({
      success: true,
      result: { rfq, purchaseOrder: po },
      message: "Supplier awarded and PO created",
    });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

exports.listPurchaseOrders = async (req, res) => {
  try {
    const filter = req.query.jobId ? { jobId: req.query.jobId } : {};
    const result = await PurchaseOrder.find(filter)
      .populate("supplierId", "name email phone address")
      .populate("jobId", "jobId customer site")
      .sort({ createdAt: -1 });
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.createPurchaseOrder = async (req, res) => {
  try {
    if (!req.body.jobId || !req.body.supplierId) {
      return res.status(400).json({
        success: false,
        message: "jobId and supplierId are required",
      });
    }
    const result = await PurchaseOrder.create(req.body);
    return res.status(201).json({ success: true, result });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

exports.updatePurchaseOrder = async (req, res) => {
  try {
    const result = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!result) return res.status(404).json({ success: false, message: "PO not found" });
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

exports.receivePurchaseOrder = async (req, res) => {
  try {
    const { lines = [] } = req.body;
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: "PO not found" });

    for (const incoming of lines) {
      const line = po.lines.id(incoming.lineId);
      if (!line) continue;
      line.receivedQty = Number(incoming.receivedQty || 0);
    }

    const totals = po.lines.reduce(
      (acc, line) => {
        acc.ordered += Number(line.orderedQty || 0);
        acc.received += Number(line.receivedQty || 0);
        return acc;
      },
      { ordered: 0, received: 0 }
    );

    if (totals.received <= 0) {
      po.status = po.status === "Delayed" ? "Delayed" : "Ordered";
    } else if (totals.received < totals.ordered) {
      po.status = "Partially Received";
    } else {
      po.status = "Received";
      po.receivedAt = new Date();
    }

    await po.save();
    return res.json({ success: true, result: po, message: "Receipt recorded" });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};
