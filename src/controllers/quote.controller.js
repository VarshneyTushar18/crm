const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const sendMail = require("@/controllers/middlewaresControllers/createAuthMiddleware/sendMail");

const Quote = mongoose.models.Quote;
const Lead = mongoose.models.Lead;
const Job = mongoose.models.Job;
const Customer = mongoose.models.Customer;
const User = mongoose.models.User;

if (!Quote) throw new Error("Quote model not loaded");
if (!Lead) throw new Error("Lead model not loaded");
if (!Job) throw new Error("Job model not loaded");
if (!Customer) throw new Error("Customer model not loaded");
if (!User) throw new Error("User model not loaded");

// helper: generate readable unique jobId
const generateJobId = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `J-${y}${m}${day}-${rand}`;
};

// helper: random password
const generateRandomPassword = (length = 10) => {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$!";
  const bytes = crypto.randomBytes(length);
  let password = "";

  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }

  return password;
};

// helper: normalize email
const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();

// helper: choose best person/company names
const getPreferredPersonName = ({ customer, quote }) => {
  return (
    quote?.contactPerson?.trim() ||
    customer?.contactPerson?.trim() ||
    quote?.customerName?.trim() ||
    customer?.name?.trim() ||
    "Customer"
  );
};

const getPreferredCompanyName = ({ customer, quote }) => {
  return (
    customer?.companyName?.trim() ||
    quote?.customerName?.trim() ||
    customer?.name?.trim() ||
    "Customer Company"
  );
};

const getPreferredMobile = ({ customer, quote }) => {
  return (
    customer?.mobile?.trim() ||
    customer?.phone?.trim() ||
    quote?.phone?.trim() ||
    "0000000000"
  );
};

// helper: create / reuse customer portal user
const createOrReuseCustomerPortalUser = async ({ customer, quote }) => {
  const email = normalizeEmail(customer?.portalEmail || customer?.email);
  if (!email) {
    return {
      success: false,
      message: "Customer email is required to create portal login",
    };
  }

  const preferredName = getPreferredPersonName({ customer, quote });
  const preferredCompanyName = getPreferredCompanyName({ customer, quote });
  const preferredMobile = getPreferredMobile({ customer, quote });

  let existingUser = await User.findOne({
    email,
    role: "customer",
  });

  if (existingUser) {
    const userUpdate = {};

    if (existingUser.name !== preferredName) {
      userUpdate.name = preferredName;
    }

    if (existingUser.companyName !== preferredCompanyName) {
      userUpdate.companyName = preferredCompanyName;
    }

    if (!existingUser.mobile || existingUser.mobile !== preferredMobile) {
      userUpdate.mobile = preferredMobile;
    }

    if (
      !existingUser.customer ||
      String(existingUser.customer) !== String(customer._id)
    ) {
      userUpdate.customer = customer._id;
    }

    if (Object.keys(userUpdate).length) {
      existingUser = await User.findByIdAndUpdate(
        existingUser._id,
        { $set: userUpdate },
        { new: true }
      );
    }

    await Customer.findByIdAndUpdate(
      customer._id,
      {
        $set: {
          user: existingUser._id,
          portalEmail: email,
          portalInvitedAt: new Date(),
        },
      },
      { new: true }
    );

    return {
      success: true,
      created: false,
      user: existingUser,
      plainPassword: null,
    };
  }

  const plainPassword = generateRandomPassword(10);
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const newUser = await User.create({
    name: preferredName,
    companyName: preferredCompanyName,
    email,
    mobile: preferredMobile,
    password: hashedPassword,
    role: "customer",
    customer: customer._id,
    isActive: true,
  });

  await Customer.findByIdAndUpdate(
    customer._id,
    {
      $set: {
        user: newUser._id,
        portalEmail: email,
        portalInvitedAt: new Date(),
      },
    },
    { new: true }
  );

  return {
    success: true,
    created: true,
    user: newUser,
    plainPassword,
  };
};

// GET /api/quote/list
exports.listQuotes = async (req, res) => {
  try {
    const page = parseInt(req.query.page || req.query.current || "1", 10);
    const items = parseInt(req.query.items || req.query.pageSize || "10", 10);
    const skip = (page - 1) * items;

    const q = (req.query.q || "").trim();
    const equal = (req.query.equal || "").toString().trim();
    const filterKey = (req.query.filter || "").toString().trim();

    let filter = {};

    if (equal && filterKey) {
      filter = {
        $or: [
          { quoteNumber: { $regex: equal, $options: "i" } },
          { customerName: { $regex: equal, $options: "i" } },
          { status: { $regex: equal, $options: "i" } },
        ],
      };
    } else if (q) {
      filter = {
        $or: [
          { quoteNumber: { $regex: q, $options: "i" } },
          { customerName: { $regex: q, $options: "i" } },
          { status: { $regex: q, $options: "i" } },
        ],
      };
    }

    const [total, result] = await Promise.all([
      Quote.countDocuments(filter),
      Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(items),
    ]);

    const pages = Math.ceil(total / items) || 1;

    return res.json({
      success: true,
      result,
      pagination: { page, items, total, pages },
      message: "Quotes fetched",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/quote/search?q=...
exports.searchQuotes = async (req, res) => {
  try {
    const q = (req.query.q || req.query.search || "").trim();

    if (!q) {
      return res.json({ success: true, result: [] });
    }

    const filter = {
      $or: [
        { quoteNumber: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { status: { $regex: q, $options: "i" } },
      ],
    };

    const result = await Quote.find(filter)
      .sort({ createdAt: -1 })
      .limit(10)
      .select("_id quoteNumber customerName status totalAmount validUntil createdAt");

    const formatted = result.map((x) => ({
      _id: x._id,
      name: `${x.quoteNumber || "Q"} - ${x.customerName || ""}`.trim(),
      quoteNumber: x.quoteNumber,
      customerName: x.customerName,
      status: x.status,
      totalAmount: x.totalAmount,
      validUntil: x.validUntil,
    }));

    return res.json({ success: true, result: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/quote/read/:id
exports.readQuote = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, message: "Quote not found" });
    }
    return res.json({ success: true, result: quote });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/quote/create
exports.createQuote = async (req, res) => {
  try {
    const payload = req.body;

    if (!payload.leadId) {
      return res.status(400).json({ success: false, message: "leadId is required" });
    }

    const lead = await Lead.findById(payload.leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    if (!payload.scope || !payload.inclusions || !payload.exclusions) {
      return res.status(400).json({
        success: false,
        message: "scope, inclusions, exclusions are required",
      });
    }

    if (
      payload.totalAmount === undefined ||
      payload.totalAmount === null ||
      payload.totalAmount === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "totalAmount is required",
      });
    }

    if (!payload.validUntil) {
      return res.status(400).json({
        success: false,
        message: "validUntil is required",
      });
    }

    const quote = await Quote.create({
      leadId: payload.leadId,

      customerName: payload.customerName || lead.clientName || "",
      contactPerson: payload.contactPerson || lead.contactPerson || "",
      phone: payload.phone || lead.phone || "",
      email: payload.email || lead.email || "",

      siteAddress: payload.siteAddress || lead.siteAddress || "",
      projectType: payload.projectType || lead.projectType || "",
      balustradeType: payload.balustradeType || lead.balustradeType || "",
      leadSource: payload.leadSource || lead.leadSource || "",

      scope: payload.scope,
      inclusions: payload.inclusions,
      exclusions: payload.exclusions,
      assumptions: payload.assumptions || "",

      totalAmount: Number(payload.totalAmount),
      validUntil: new Date(payload.validUntil),

      valueLevel: payload.valueLevel || "Medium",
      priority: payload.priority || 2,
      categoryCode: payload.categoryCode || "Residential",
      materialCode: payload.materialCode || "Aluminium",

      status: payload.status || "Draft",
    });

    await Lead.findByIdAndUpdate(payload.leadId, { status: "Quoted" }, { new: true });

    return res.json({
      success: true,
      result: quote,
      message: "Quote created",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// PATCH /api/quote/update/:id
exports.updateQuote = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, message: "Quote not found" });
    }

    if (quote.status === "Accepted" || quote.status === "Converted to Job") {
      return res.status(400).json({
        success: false,
        message: "Accepted/Converted quote cannot be edited",
      });
    }

    const payload = { ...req.body };

    const currentSnapshot = quote.toObject();
    delete currentSnapshot._id;
    delete currentSnapshot.revisions;
    delete currentSnapshot.version;

    payload.revisions = [...(quote.revisions || []), currentSnapshot];
    payload.version = (quote.version || 1) + 1;

    if (payload.totalAmount !== undefined) {
      payload.totalAmount = Number(payload.totalAmount);
    }

    if (payload.validUntil) {
      payload.validUntil = new Date(payload.validUntil);
    }

    const updated = await Quote.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    return res.json({
      success: true,
      result: updated,
      message: "Quote updated",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /api/quote/delete/:id
exports.deleteQuote = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, message: "Quote not found" });
    }

    if (quote.status === "Converted to Job") {
      return res.status(400).json({
        success: false,
        message: "Converted quote cannot be deleted",
      });
    }

    await Quote.findByIdAndDelete(req.params.id);
    return res.json({ success: true, result: null, message: "Quote deleted" });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/quote/approve/:id
exports.approveQuoteAndCreateJob = async (req, res) => {
  try {
    const quoteId = req.params.id;
    const { method, acceptedBy } = req.body;

    const quote = await Quote.findById(quoteId);
    if (!quote) {
      return res.status(404).json({ success: false, message: "Quote not found" });
    }

    if (quote.status === "Accepted" || quote.status === "Converted to Job" || quote.jobId) {
      return res.json({
        success: true,
        result: { jobId: quote.jobId, customerId: quote.customerId },
        message: "Quote already accepted/converted",
      });
    }

    if (!method || !acceptedBy) {
      return res.status(400).json({
        success: false,
        message: "Acceptance method and user are required to accept a quote",
      });
    }

    let customer = null;
    const email = normalizeEmail(quote.email);

    if (email) {
      customer = await Customer.findOne({ email });
    }
    if (!customer && quote.phone) {
      customer = await Customer.findOne({
        $or: [{ phone: quote.phone }, { mobile: quote.phone }],
      });
    }

    if (!customer) {
      customer = await Customer.create({
        name: quote.customerName || quote.contactPerson || "Customer",
        companyName: quote.customerName || "",
        email,
        phone: quote.phone || "",
        mobile: quote.phone || "",
        address: quote.siteAddress || "",
        contactPerson: quote.contactPerson || "",
        leadId: quote.leadId || null,
        status: "Active",
      });
    } else {
      const customerUpdate = {};

      if (email && customer.email !== email) customerUpdate.email = email;
      if (quote.phone && !customer.phone) customerUpdate.phone = quote.phone;
      if (quote.phone && !customer.mobile) customerUpdate.mobile = quote.phone;
      if (quote.siteAddress && !customer.address) customerUpdate.address = quote.siteAddress;
      if (quote.contactPerson && customer.contactPerson !== quote.contactPerson) {
        customerUpdate.contactPerson = quote.contactPerson;
      }
      if (quote.customerName && !customer.companyName) {
        customerUpdate.companyName = quote.customerName;
      }

      if (Object.keys(customerUpdate).length) {
        customer = await Customer.findByIdAndUpdate(
          customer._id,
          { $set: customerUpdate },
          { new: true }
        );
      }
    }

    const jobCode = generateJobId();

    const job = await Job.create({
      jobId: jobCode,
      customerId: customer._id,
      customer: quote.customerName || customer?.name || "",
      site: quote.siteAddress || customer?.address || "",
      address: quote.siteAddress || customer?.address || "",
      projectType: quote.projectType || quote.categoryCode || "",
      lockedValue: Number(quote.totalAmount || 0),
      leadId: quote.leadId || null,
      quoteId: quote._id,
    });

    quote.status = "Accepted";
    quote.approvedAt = new Date();
    quote.acceptanceAudit = {
      method,
      acceptedBy,
      acceptedAt: new Date(),
    };
    quote.customerId = customer._id;
    quote.jobId = job._id;
    await quote.save();

    await Lead.findByIdAndUpdate(
      quote.leadId,
      { status: "Converted", isLocked: true },
      { new: true }
    );

    let portalUserResult = null;
    let onboardingMailSent = false;

    if (email) {
      const companyNameForUser = getPreferredCompanyName({ customer, quote });
      const mobileForUser = getPreferredMobile({ customer, quote });

      customer = await Customer.findByIdAndUpdate(
        customer._id,
        {
          $set: {
            companyName: companyNameForUser,
            mobile: mobileForUser,
            portalEmail: email,
            name: quote.customerName || customer.name || "Customer",
            contactPerson: quote.contactPerson || customer.contactPerson || "",
          },
        },
        { new: true }
      );

      portalUserResult = await createOrReuseCustomerPortalUser({ customer, quote });

      if (!portalUserResult.success) {
        return res.status(500).json({
          success: false,
          message: portalUserResult.message,
        });
      }

      if (portalUserResult.created && portalUserResult.plainPassword) {
        const loginLink =
          process.env.CUSTOMER_PORTAL_URL || "http://localhost:3000/portal/login";

        const mailRes = await sendMail({
          email,
          name: getPreferredPersonName({ customer, quote }),
          link: loginLink,
          idurar_app_email: process.env.MAIL_FROM,
          subject: "Your Customer Portal Login Details",
          type: "customerOnboarding",
          password: portalUserResult.plainPassword,
        });

        onboardingMailSent = !!mailRes?.success || !!mailRes?.id || !!mailRes?.data;
      }
    }

    return res.json({
      success: true,
      result: {
        jobId: job._id,
        jobCode,
        customerId: customer._id,
        quoteId: quote._id,
        portalUserCreated: !!portalUserResult?.created,
        onboardingMailSent,
      },
      message: email
        ? "Quote approved, job created, and customer portal setup completed."
        : "Quote approved and job created, but customer email was missing for portal setup.",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/quote/download/:id (PDF)
exports.downloadQuotePdf = async (req, res) => {
  try {
    const PDFDocument = require("pdfkit");
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return res.status(404).json({ success: false, message: "Quote not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Quote-${quote.quoteNumber || quote._id}.pdf`
    );

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    doc.fontSize(18).text("Bright Balustrading", { align: "left" });
    doc.fontSize(10).fillColor("#555").text("Quote Document", { align: "left" });
    doc.moveDown(1);

    doc.fillColor("#000");
    doc.fontSize(12).text(`Quote No: ${quote.quoteNumber || "-"}`);
    doc.text(`Date: ${new Date(quote.createdAt).toLocaleDateString()}`);
    doc.text(`Status: ${quote.status || "Draft"}`);
    doc.text(
      `Valid Until: ${
        quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : "-"
      }`
    );
    doc.moveDown(1);

    doc.fontSize(12).text("Client Details", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Client Name: ${quote.customerName || "-"}`);
    doc.text(`Contact Person: ${quote.contactPerson || "-"}`);
    doc.text(`Phone: ${quote.phone || "-"}`);
    doc.text(`Email: ${quote.email || "-"}`);
    doc.moveDown(1);

    doc.fontSize(12).text("Project Details", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Site Address: ${quote.siteAddress || "-"}`);
    doc.text(`Project Type: ${quote.projectType || "-"}`);
    doc.text(`Balustrade Type: ${quote.balustradeType || "-"}`);
    doc.text(`Lead Source: ${quote.leadSource || "-"}`);
    doc.moveDown(1);

    doc.fontSize(12).text("Scope", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(quote.scope || "-", { width: 515 });
    doc.moveDown(1);

    doc.fontSize(12).text("Inclusions", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(quote.inclusions || "-", { width: 515 });
    doc.moveDown(1);

    doc.fontSize(12).text("Exclusions", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(quote.exclusions || "-", { width: 515 });
    doc.moveDown(1);

    if (quote.assumptions) {
      doc.fontSize(12).text("Assumptions", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(quote.assumptions, { width: 515 });
      doc.moveDown(1);
    }

    doc.fontSize(12).text("Quote Summary", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Total Quote Value: ${quote.totalAmount ?? 0}`, {
      align: "right",
    });

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#777").text(
      "Note: This quote is subject to final site verification and standard terms & conditions.",
      { width: 515 }
    );

    doc.end();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};