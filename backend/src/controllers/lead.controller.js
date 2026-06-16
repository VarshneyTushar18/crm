const mongoose = require("mongoose");

const Lead = mongoose.models.Lead;
const Job = mongoose.models.Job;
const Customer = mongoose.models.Customer;
const User = mongoose.models.User;

const bcrypt = require("bcryptjs");
const { generate: uniqueId } = require('shortid');
const sendMail = require("../controllers/middlewaresControllers/createAuthMiddleware/sendMail");

if (!Lead) throw new Error("Lead model not loaded");
if (!Job) throw new Error("Job model not loaded");
if (!Customer) throw new Error("Customer model not loaded");
if (!User) throw new Error("User model not loaded");

// ✅ GET /api/lead/read/:id
exports.readLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    return res.json({ success: true, result: lead });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ GET /api/lead/list
exports.listLeads = async (req, res) => {
  try {
    const leads = await Lead.find({}).sort({ createdAt: -1 });
    return res.json({ success: true, result: leads });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ POST /api/lead/:id/interaction
exports.addInteraction = async (req, res) => {
  try {
    const { type, notes, createdBy } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    
    if (lead.isLocked) {
      return res.status(400).json({ success: false, message: "Cannot modify a locked lead" });
    }

    lead.interactions.push({
      type: type || "Note",
      notes: notes,
      createdBy: createdBy || "System",
      date: new Date()
    });
    
    // Update next follow-up date if provided
    if (req.body.nextFollowUpDate) {
      lead.nextFollowUpDate = new Date(req.body.nextFollowUpDate);
    }
    
    // Update status if provided
    if (req.body.status) {
      lead.status = req.body.status;
    }

    await lead.save();
    return res.json({ success: true, result: lead, message: "Interaction added" });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ✅ POST /api/lead/create
exports.createLead = async (req, res) => {
  try {
    const lead = await Lead.create(req.body);
    return res.json({ success: true, result: lead, message: "Lead created" });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ✅ PATCH /api/lead/update/:id
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    return res.json({ success: true, result: lead, message: "Lead updated" });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ✅ DELETE /api/lead/delete/:id
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    return res.json({ success: true, message: "Lead deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ POST /api/lead/convert-to-job/:id
exports.createJobFromLead = async (req, res) => {
  try {
    const leadId = req.params.id;

    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    // ✅ If already converted - return existing job
    if (lead.isConverted && lead.convertedToJobId) {
      const existingJob = await Job.findById(lead.convertedToJobId);
      return res.json({
        success: true,
        result: { job: existingJob, customer: null },
        message: "Lead already converted",
      });
    }

    // =========================
    // 1) Create/Find Customer
    // =========================
    const emailLower = String(lead.email || "").toLowerCase().trim();

    let customer =
      (await Customer.findOne({ leadId: lead._id })) ||
      (emailLower ? await Customer.findOne({ email: emailLower }) : null);

    if (!customer) {
      customer = await Customer.create({
        leadId: lead._id,

        // ✅ Lead me clientName hai, wahi customer name banao
        name: lead.clientName || "Customer",

        companyName: lead.companyName || "",
        email: emailLower,
        phone: lead.phone || "",

        // ✅ Customer schema me address nahi hai, so ignore or add field in schema if you want
        // address: lead.siteAddress || "",

        status: "Active",
      });

      // ✅ Only create User account if email is available
      if (emailLower) {
        // ✅ Check if user already exists
        const existingUser = await User.findOne({ email: emailLower, role: "customer" });
        if (!existingUser) {
          // ✅ Generate random password for customer
          const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
          const hashedPassword = await bcrypt.hash(randomPassword, 10);

          // ✅ Create User account for customer
          const user = await User.create({
            name: customer.name,
            companyName: customer.companyName,
            email: emailLower,
            mobile: lead.phone || "",
            password: hashedPassword,
            role: "customer",
            isActive: true,
          });

          // ✅ Send onboarding email
          try {
            const idurar_app_email = process.env.IDURAR_APP_EMAIL || "noreply@idurarapp.com";
            await sendMail({
              email: emailLower,
              name: customer.name,
              link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/login`,
              idurar_app_email,
              subject: 'Welcome to IDURAR - Your Account is Ready',
              type: 'customerOnboarding',
              password: randomPassword,
            });
          } catch (emailError) {
            console.error("Failed to send customer onboarding email:", emailError);
            // Don't fail the whole operation if email fails
          }
        }
      }
    }

    // =========================
    // 2) Generate jobId
    // =========================
    const lastJob = await Job.findOne({ jobId: { $exists: true } }).sort({ createdAt: -1 });
    let nextNumber = 1;

    if (lastJob?.jobId) {
      const match = String(lastJob.jobId).match(/(\d+)$/);
      if (match) nextNumber = parseInt(match[1], 10) + 1;
    }

    const jobId = `JOB-${String(nextNumber).padStart(5, "0")}`;

    // =========================
    // 3) Create Job (✅ Job model ke fields only)
    // =========================
    const job = await Job.create({
      jobId,

      // ✅ Job model me customer string hai, so store customer name here
      customer: customer.name || "",

      // ✅ Also set customerId for proper linking
      customerId: customer._id,

      // ✅ Job model me site string hai
      site: lead.siteAddress || "",

      // ✅ enums only
      stage: "Backlog (Contract Stage)",
      status: "Active", // ✅ allowed: Backlog/Active/On Hold/Closed (tumhare STATUSES ke hisab se)

      leadId: lead._id,
    });

    // =========================
    // 4) Mark lead converted
    // =========================
    lead.status = "Converted";
    lead.isConverted = true;
    lead.convertedToJobId = job._id;
    await lead.save();

    return res.json({
      success: true,
      result: { job, customer },
      message: "Lead converted to Job + Customer created/linked",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
