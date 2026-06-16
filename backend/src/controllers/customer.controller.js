const mongoose = require("mongoose");

// Idurar loads models via glob, so use already registered models
const Customer = mongoose.models.Customer;
const User = mongoose.models.User;
const Job = require("../models/appModels/Job");
const Payment = mongoose.models.Payment;
const Invoice = mongoose.models.Invoice;

if (!Customer) {
  throw new Error(
    "Customer model not loaded. Ensure backend loads models before controllers."
  );
}

if (!User) {
  throw new Error(
    "User model not loaded. Ensure backend loads models before controllers."
  );
}

if (!Job) {
  throw new Error(
    "Job model not loaded. Ensure backend loads models before controllers."
  );
}

// ================= HELPERS =================
const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();

const activeFilter = {
  $or: [{ removed: { $exists: false } }, { removed: false }],
};

const getUserIdFromReq = (req) => {
  return (
    req.admin?._id ||
    req.user?._id ||
    req.user?.id ||
    req.auth?._id ||
    req.auth?.id ||
    req.userId ||
    null
  );
};

const getLoggedInUser = async (req) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return null;

  return await User.findById(userId).select(
    "-password -resetPasswordTokenHash -resetPasswordExpires"
  );
};

const getCustomerForUser = async (user) => {
  if (!user) return null;

  // 1. direct linked customer
  if (user.customer) {
    const linkedCustomer = await Customer.findById(user.customer);
    if (linkedCustomer) return linkedCustomer;
  }

  // 2. portalEmail exact match, prefer latest
  if (user.email) {
    const customerByPortalEmail = await Customer.findOne({
      portalEmail: normalizeEmail(user.email),
    }).sort({ createdAt: -1 });

    if (customerByPortalEmail) return customerByPortalEmail;
  }

  // 3. fallback email exact match, prefer latest
  if (user.email) {
    const customerByEmail = await Customer.findOne({
      email: normalizeEmail(user.email),
    }).sort({ createdAt: -1 });

    if (customerByEmail) return customerByEmail;
  }

  return null;
};

// ✅ STRICT SECURITY: customer can only access jobs linked by customerId
const buildCustomerJobFilter = (customer) => {
  if (!customer?._id) return null;
  return { customerId: customer._id };
};

// ================= CUSTOMER PORTAL: ME =================
exports.me = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const customer = await getCustomerForUser(user);

    return res.json({
      success: true,
      result: {
        _id: user._id,
        userId: user._id,
        customerId: customer?._id || null,
        name: user?.name || customer?.name || "",
        fullName: user?.name || customer?.name || "",
        email: user?.email || customer?.portalEmail || customer?.email || "",
        companyName: customer?.companyName || user?.companyName || "",
        mobile: customer?.mobile || customer?.phone || user?.mobile || "",
        phone: customer?.phone || "",
        address: customer?.address || "",
        contactPerson: customer?.contactPerson || "",
        role: user?.role || "customer",
        user,
        customer,
      },
      message: "Customer profile fetched successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= CUSTOMER PORTAL: PROJECTS =================
exports.projects = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const customer = await getCustomerForUser(user);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer record not found",
      });
    }

    const ownershipFilter = buildCustomerJobFilter(customer);

    if (!ownershipFilter) {
      return res.json({
        success: true,
        result: [],
        message: "No projects found",
      });
    }

    const jobs = await Job.find({
      ...ownershipFilter,
      ...activeFilter,
    })
      .populate("leadId", "category projectType")
      .sort({ createdAt: -1 });

    const results = jobs.map((j) => {
      const obj = j.toObject();
      return {
        ...obj,
        projectType: obj.leadId?.category || obj.leadId?.projectType || "Residential",
        categoryCode: obj.leadId?.category || obj.leadId?.projectType || "Residential",
      };
    });

    return res.json({
      success: true,
      result: results,
      message: "Projects fetched successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= CUSTOMER PORTAL: PROJECT DETAILS =================
exports.projectById = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const customer = await getCustomerForUser(user);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer record not found",
      });
    }

    const ownershipFilter = buildCustomerJobFilter(customer);

    if (!ownershipFilter) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const project = await Job.findOne({
      _id: req.params.id,
      ...ownershipFilter,
      ...activeFilter,
    }).populate("leadId", "category projectType");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const obj = project.toObject();
    const result = {
      ...obj,
      projectType: obj.leadId?.category || obj.leadId?.projectType || "Residential",
      categoryCode: obj.leadId?.category || obj.leadId?.projectType || "Residential",
    };

    return res.json({
      success: true,
      result: result,
      message: "Project fetched successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= CUSTOMER PORTAL: PAYMENT SUMMARY =================
exports.paymentSummary = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const customer = await getCustomerForUser(user);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer record not found",
      });
    }

    if (!Payment) {
      return res.json({
        success: true,
        result: {
          count: 0,
          total: 0,
          items: [],
        },
        message: "Payment model not available",
      });
    }

    const jobIds = await Job.find({
      customerId: customer._id,
      ...activeFilter,
    }).distinct("_id");

    const invoiceIds = await Invoice.find({
      job: { $in: jobIds },
      removed: false,
    }).distinct("_id");

    const payments = await Payment.find({
      invoice: { $in: invoiceIds },
      removed: false,
    })
      .populate("invoice", "number total status")
      .sort({ createdAt: -1 });

    const total = payments.reduce((sum, item) => {
      return sum + (Number(item.amount) || Number(item.total) || 0);
    }, 0);

    return res.json({
      success: true,
      result: {
        count: payments.length,
        total,
        items: payments,
      },
      message: "Payment summary fetched successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= CUSTOMER PORTAL: INVOICES =================
exports.invoices = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const customer = await getCustomerForUser(user);
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    // Find all jobs for this customer
    const jobIds = await Job.find({ customerId: customer._id, ...activeFilter }).distinct("_id");

    const invoices = await Invoice.find({
      job: { $in: jobIds },
      removed: false,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      result: invoices,
      message: "Invoices fetched successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================= CUSTOMER PORTAL: NOTIFY PAYMENT =================
exports.notifyPayment = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const customer = await getCustomerForUser(user);
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    const { id } = req.params;
    const { paymentRef, paymentMode, date } = req.body || {};

    const invoice = await Invoice.findOne({
      _id: id,
      removed: false,
    }).populate("job");

    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    // Security: check if invoice belongs to current customer
    if (invoice.job.customerId.toString() !== customer._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      id,
      {
        paymentNotified: true,
        paymentRef,
        paymentMode,
        notificationDate: date || new Date(),
      },
      { new: true }
    );

    return res.json({
      success: true,
      result: updatedInvoice,
      message: "Payment notification sent successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


// ================= CUSTOMER PORTAL: SUBMIT ENQUIRY =================
exports.submitEnquiry = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const customer = await getCustomerForUser(user);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer record not found",
      });
    }

    const { subject, message, projectId, priority } = req.body || {};

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: "subject and message are required",
      });
    }

    let project = null;

    if (projectId) {
      project = await Job.findOne({
        _id: projectId,
        customerId: customer._id,
        ...activeFilter,
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Selected project not found",
        });
      }
    }

    const enquiryPayload = {
      customerId: customer._id,
      userId: user._id,
      customerName: user?.name || customer?.name,
      email: user?.email || customer?.portalEmail || customer?.email,
      subject,
      message,
      priority: priority || "Normal",
      projectId: project?._id || null,
      projectName: project?.jobId || project?.title || project?.name || null,
      createdAt: new Date(),
    };

    console.log("Customer enquiry:", enquiryPayload);

    return res.json({
      success: true,
      result: enquiryPayload,
      message: "Enquiry received successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= ADMIN: LIST =================
exports.list = async (req, res) => {
  try {
    const result = await Customer.find().sort({ createdAt: -1 });

    return res.json({
      success: true,
      result,
      message: "Customers fetched successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= ADMIN: CREATE =================
exports.create = async (req, res) => {
  try {
    const payload = req.body || {};

    if (!payload.name || !payload.companyName || !payload.email) {
      return res.status(400).json({
        success: false,
        message: "name, companyName, email are required",
      });
    }

    payload.email = normalizeEmail(payload.email);
    if (payload.portalEmail) payload.portalEmail = normalizeEmail(payload.portalEmail);

    const exists = await Customer.findOne({ email: payload.email });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Customer already exists with this email",
      });
    }

    const result = await Customer.create(payload);

    return res.json({
      success: true,
      result,
      message: "Customer created successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= ADMIN: UPDATE =================
exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};

    if (payload.email) payload.email = normalizeEmail(payload.email);
    if (payload.portalEmail) payload.portalEmail = normalizeEmail(payload.portalEmail);

    const result = await Customer.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.json({
      success: true,
      result,
      message: "Customer updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= ADMIN: DELETE =================
exports.delete = async (req, res) => {
  try {
    const id = req.params.id;

    const existing = await Customer.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    await Customer.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};