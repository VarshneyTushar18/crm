// controllers/appControllers/leadController/leadController.js
const Lead = require('@/models/Lead'); // adjust path if your project doesn't support '@' alias

// GET /api/lead/list
exports.list = async (req, res) => {
  try {
    const leads = await Lead.find({});
    res.json({
      success: true,
      result: leads,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// POST /api/lead/create
exports.create = async (req, res) => {
  try {
    const lead = new Lead(req.body);
    await lead.save();
    res.json({
      success: true,
      result: lead,
      message: 'Lead created successfully',
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// PATCH /api/lead/update/:id
exports.update = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found',
      });
    }
    res.json({
      success: true,
      result: lead,
      message: 'Lead updated successfully',
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// DELETE /api/lead/delete/:id
exports.remove = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found',
      });
    }
    res.json({
      success: true,
      message: 'Lead deleted successfully',
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};