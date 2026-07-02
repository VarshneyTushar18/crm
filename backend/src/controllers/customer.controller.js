const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

// Idurar loads models via glob, so use already registered models
const Customer = mongoose.models.Customer;
const User = mongoose.models.User;
const Job = require("../models/appModels/Job");
const Payment = mongoose.models.Payment;
const Invoice = mongoose.models.Invoice;
const { sanitizeJobForPortal } = require("../utils/portalJobMapper");
const { migrateJobWorkflowToV3 } = require("../utils/workflowDefaults");
const { sanitizeQuoteForPortal } = require("../utils/linkJobQuote");
const { notifyAdminPaymentClaim } = require("../services/notificationService");

const Quote = mongoose.models.Quote;
const Drafting = mongoose.models.Drafting;
const SiteMeasurement = mongoose.models.SiteMeasurement;

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

const generateRandomPassword = (length = 10) => {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$!";
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
};

const getCustomerLoginEmail = (customer) =>
  normalizeEmail(customer?.portalEmail || customer?.email);

const findPortalUserForCustomer = async (customer) => {
  if (!customer) return null;

  if (customer.user) {
    const linked = await User.findOne({
      _id: customer.user,
      role: "customer",
    }).select("-password");
    if (linked) return linked;
  }

  const email = getCustomerLoginEmail(customer);
  if (!email) return null;

  return User.findOne({ email, role: "customer" }).select("-password");
};

const ensureCustomerPortalUser = async (customer, password) => {
  const email = getCustomerLoginEmail(customer);
  if (!email) {
    throw new Error("Customer email is required to create portal login");
  }

  const plainPassword = password || generateRandomPassword(10);
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  let user = await findPortalUserForCustomer(customer);
  let created = false;

  if (user) {
    user.password = hashedPassword;
    user.name = customer.name || user.name;
    user.companyName = customer.companyName || user.companyName;
    user.mobile = customer.mobile || customer.phone || user.mobile;
    user.customer = customer._id;
    user.isActive = true;
    await user.save();
  } else {
    user = await User.create({
      name: customer.name || "Customer",
      companyName: customer.companyName || "",
      email,
      mobile: customer.mobile || customer.phone || "",
      password: hashedPassword,
      role: "customer",
      customer: customer._id,
      isActive: true,
    });
    created = true;
  }

  await Customer.findByIdAndUpdate(customer._id, {
    $set: {
      user: user._id,
      portalEmail: email,
      portalInvitedAt: new Date(),
    },
  });

  return { user, plainPassword, created };
};

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
      const portal = sanitizeJobForPortal(j);
      return {
        ...obj,
        ...portal,
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

    let project = await Job.findOne({
      _id: req.params.id,
      ...ownershipFilter,
      ...activeFilter,
    })
      .populate("leadId", "category projectType")
      .populate("quoteId");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (Number(project.workflowVersion || 1) < 3) {
      await migrateJobWorkflowToV3(project);
      project = await Job.findById(req.params.id)
        .populate("leadId", "category projectType")
        .populate("quoteId");
    }

    const obj = project.toObject();
    const portalView = sanitizeJobForPortal(project);

    const jobMap = { [String(project._id)]: { _id: project._id, jobId: project.jobId } };
    const result = {
      ...obj,
      ...portalView,
      projectType: obj.leadId?.category || obj.leadId?.projectType || "Residential",
      categoryCode: obj.leadId?.category || obj.leadId?.projectType || "Residential",
      quote: sanitizeQuoteForPortal(project.quoteId, jobMap),
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

// ================= CUSTOMER PORTAL: FINANCIAL SUMMARY =================
exports.financialSummary = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const customer = await getCustomerForUser(user);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const jobs = await Job.find({ customerId: customer._id, ...activeFilter });
    const jobIds = jobs.map((j) => j._id);

    const invoices = Invoice
      ? await Invoice.find({ job: { $in: jobIds }, removed: false })
      : [];

    const contractTotal = jobs.reduce((sum, j) => sum + Number(j.lockedValue || 0), 0);
    const totalInvoiced = jobs.reduce((sum, j) => sum + Number(j.totalInvoiced || 0), 0);
    const totalPaid = jobs.reduce((sum, j) => sum + Number(j.totalPaid || 0), 0);

    const milestones = invoices.map((inv) => ({
      _id: inv._id,
      number: inv.number,
      total: inv.total,
      status: inv.status,
      job: inv.job,
      dueDate: inv.expiredDate || inv.date,
    }));

    return res.json({
      success: true,
      result: {
        contractTotal,
        totalInvoiced,
        totalPaid,
        outstandingBalance: Math.max(0, totalInvoiced - totalPaid),
        milestones,
        projectCount: jobs.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
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

// ================= CUSTOMER PORTAL: QUOTES =================
exports.quotes = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (user.role !== "customer") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const customer = await getCustomerForUser(user);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer record not found" });
    }

    if (!Quote) {
      return res.json({ success: true, result: [], message: "Quote model not available" });
    }

    const jobs = await Job.find({ customerId: customer._id, ...activeFilter }).select(
      "_id jobId"
    );
    const jobIds = jobs.map((j) => j._id);
    const jobMap = Object.fromEntries(jobs.map((j) => [String(j._id), j.toObject()]));

    const quotes = await Quote.find({
      jobId: { $in: jobIds },
      $or: [{ removed: { $exists: false } }, { removed: false }],
    })
      .sort({ createdAt: -1 })
      .lean();

    const result = quotes.map((q) => sanitizeQuoteForPortal(q, jobMap));

    return res.json({
      success: true,
      result,
      message: "Quotes fetched successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.quoteById = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (user.role !== "customer") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const customer = await getCustomerForUser(user);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer record not found" });
    }

    if (!Quote) {
      return res.status(404).json({ success: false, message: "Quote not found" });
    }

    const quote = await Quote.findById(req.params.id).lean();
    if (!quote || quote.removed) {
      return res.status(404).json({ success: false, message: "Quote not found" });
    }

    if (!quote.jobId) {
      return res.status(404).json({ success: false, message: "Quote not found" });
    }

    const job = await Job.findOne({
      _id: quote.jobId,
      customerId: customer._id,
      ...activeFilter,
    }).select("_id jobId");

    if (!job) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const jobMap = { [String(job._id)]: job.toObject() };

    return res.json({
      success: true,
      result: sanitizeQuoteForPortal(quote, jobMap),
      message: "Quote fetched successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================= CUSTOMER PORTAL: DOCUMENTS =================
exports.documents = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const customer = await getCustomerForUser(user);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const jobs = await Job.find({ customerId: customer._id, ...activeFilter }).select(
      "_id jobId"
    );
    const jobIds = jobs.map((j) => j._id);
    const jobMap = Object.fromEntries(jobs.map((j) => [String(j._id), j.jobId]));

    const [draftings, measurements, quotes] = await Promise.all([
      Drafting
        ? Drafting.find({ jobId: { $in: jobIds }, fileUrl: { $ne: "" } }).sort({
            updatedAt: -1,
          })
        : [],
      SiteMeasurement
        ? SiteMeasurement.find({ jobId: { $in: jobIds } }).sort({ updatedAt: -1 })
        : [],
      Quote
        ? Quote.find({
            jobId: { $in: jobIds },
            $or: [{ removed: { $exists: false } }, { removed: false }],
          }).sort({ updatedAt: -1 })
        : [],
    ]);

    const documents = [];

    for (const d of draftings) {
      documents.push({
        _id: d._id,
        type: "Drawing",
        title: d.title,
        revision: d.revision,
        fileUrl: d.fileUrl,
        jobId: d.jobId,
        jobCode: jobMap[String(d.jobId)] || "",
        status: d.status,
        updatedAt: d.updatedAt,
      });
    }

    for (const m of measurements) {
      for (const url of m.photoUrls || []) {
        documents.push({
          _id: `${m._id}-${url}`,
          type: "Site Photo",
          title: "Site measurement photo",
          fileUrl: url,
          jobId: m.jobId,
          jobCode: jobMap[String(m.jobId)] || "",
          status: m.status,
          updatedAt: m.updatedAt,
        });
      }
    }

    for (const q of quotes) {
      documents.push({
        _id: q._id,
        type: "Quote",
        title: q.quoteNumber || "Quote",
        fileUrl: null,
        jobId: q.jobId,
        jobCode: jobMap[String(q.jobId)] || "",
        status: q.status,
        amount: q.totalAmount,
        updatedAt: q.updatedAt,
      });
    }

    documents.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return res.json({
      success: true,
      result: documents,
      message: "Documents fetched successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
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
      status: { $ne: "Draft" },
    })
      .populate("job", "jobId customer site customerId")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      result: invoices,
      message: "Invoices fetched successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.invoiceById = async (req, res) => {
  try {
    const user = await getLoggedInUser(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const customer = await getCustomerForUser(user);
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    const jobIds = await Job.find({ customerId: customer._id, ...activeFilter }).distinct("_id");

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      job: { $in: jobIds },
      removed: false,
      status: { $ne: "Draft" },
    }).populate("job", "jobId customer site customerId lockedValue");

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    let company = {
      name: "Bright Balustrading",
      address: "",
      phone: "",
      email: "",
      regNumber: "",
      bankDetails: "",
      logoUrl: "",
    };

    try {
      const { loadSettings } = require("../middlewares/settings");
      const settings = await loadSettings();
      const publicBase = process.env.PUBLIC_SERVER_FILE || "";
      company = {
        name: settings.company_name || company.name,
        address: settings.company_address || "",
        phone: settings.company_phone || "",
        email: settings.company_email || "",
        regNumber: settings.company_reg_number || "",
        bankDetails: settings.company_bank_details || settings.bank_details || "",
        logoUrl: settings.company_logo
          ? `${publicBase}${settings.company_logo}`.replace(/([^:]\/)\/+/g, "$1")
          : "",
      };
    } catch {
      // Use defaults if settings are unavailable.
    }

    const billTo = {
      name: customer.companyName || customer.name || invoice.job?.customer || "",
      contactPerson: customer.contactPerson || "",
      address: customer.address || invoice.job?.site || "",
      email: customer.email || customer.portalEmail || "",
      phone: customer.phone || customer.mobile || "",
    };

    return res.json({
      success: true,
      result: {
        invoice,
        company,
        billTo,
      },
      message: "Invoice fetched successfully",
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

    try {
      await notifyAdminPaymentClaim({
        invoice: { ...updatedInvoice.toObject(), job: invoice.job },
        customer,
        paymentRef,
        paymentMode,
        amount: invoice.amountDue,
      });
    } catch {
      // Payment claim saved even if admin notification fails.
    }

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
    const customers = await Customer.find().sort({ createdAt: -1 }).lean();

    const result = await Promise.all(
      customers.map(async (customer) => {
        const portalUser = await findPortalUserForCustomer(customer);
        return {
          ...customer,
          hasPortalLogin: !!portalUser,
          portalLoginEmail: portalUser?.email || getCustomerLoginEmail(customer) || "",
        };
      })
    );

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

// ================= ADMIN: CREATE / RESET PORTAL LOGIN =================
exports.setupPortalLogin = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can create customer portal logins",
      });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const existing = await findPortalUserForCustomer(customer);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Portal login already exists. Use Reset Password instead.",
        result: {
          hasPortalLogin: true,
          portalLoginEmail: existing.email,
        },
      });
    }

    const { plainPassword, user, created } = await ensureCustomerPortalUser(
      customer,
      req.body?.password
    );

    return res.json({
      success: true,
      result: {
        customerId: customer._id,
        portalLoginEmail: user.email,
        password: plainPassword,
        created,
      },
      message: created
        ? "Portal login created successfully"
        : "Portal login updated successfully",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.resetPortalPassword = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can reset customer passwords",
      });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const newPassword = req.body?.newPassword || req.body?.password;
    if (newPassword && String(newPassword).trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const { plainPassword, user, created } = await ensureCustomerPortalUser(
      customer,
      newPassword
    );

    return res.json({
      success: true,
      result: {
        customerId: customer._id,
        portalLoginEmail: user.email,
        password: plainPassword,
        createdLogin: created,
      },
      message: created
        ? "Portal login created and password set"
        : "Customer portal password reset successfully",
    });
  } catch (err) {
    return res.status(400).json({
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