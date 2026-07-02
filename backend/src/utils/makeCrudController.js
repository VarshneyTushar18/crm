const mongoose = require("mongoose");

function makeCrudController(ModelName, label = "Record") {
  const Model = mongoose.model(ModelName);

  return {
    list: async (req, res) => {
      try {
        const filter = {};
        if (req.query.jobId) filter.jobId = req.query.jobId;
        if (req.query.isActive !== undefined) {
          filter.isActive = req.query.isActive === "true";
        }
        const result = await Model.find(filter).sort({ createdAt: -1 }).lean();
        return res.json({ success: true, result, message: `${label} list` });
      } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
      }
    },
    read: async (req, res) => {
      try {
        const result = await Model.findById(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: `${label} not found` });
        return res.json({ success: true, result, message: `${label} fetched` });
      } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
      }
    },
    create: async (req, res) => {
      try {
        const result = await Model.create(req.body);
        return res.status(201).json({ success: true, result, message: `${label} created` });
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message });
      }
    },
    update: async (req, res) => {
      try {
        const result = await Model.findByIdAndUpdate(req.params.id, req.body, {
          new: true,
          runValidators: true,
        });
        if (!result) return res.status(404).json({ success: false, message: `${label} not found` });
        return res.json({ success: true, result, message: `${label} updated` });
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message });
      }
    },
    remove: async (req, res) => {
      try {
        const result = await Model.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: `${label} not found` });
        return res.json({ success: true, result, message: `${label} deleted` });
      } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
      }
    },
  };
}

module.exports = { makeCrudController };
