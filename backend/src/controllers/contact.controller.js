const Contact = require("@/models/appModels/Contact");
const Job = require("@/models/appModels/Job");

const getCustomerContactFilter = (user) => {
  const customerId = user.customer || user._id;
  return { customerId };
};

const isAdminUser = (user) => {
  return String(user?.role || "").trim().toLowerCase() === "admin";
};

const isCustomerUser = (user) => {
  return String(user?.role || "").trim().toLowerCase() === "customer";
};

exports.createContact = async (req, res) => {
  try {
    const user = req.user;
    const customerId = user.customer || user._id;
    const { projectId, subject, message, priority } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ message: "Subject & message required" });
    }

    if (projectId) {
      const job = await Job.findOne({
        _id: projectId,
        customerId,
      });

      if (!job) {
        return res.status(403).json({ message: "Invalid project" });
      }
    }

    const contact = await Contact.create({
      customerId,
      projectId,
      subject,
      message,
      priority,
      conversation: [
        {
          sender: "customer",
          userId: user._id,
          message,
        },
      ],
    });

    return res.status(201).json({
      success: true,
      result: contact,
      message: "Query submitted successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.listContacts = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      console.warn("Contact list forbidden", {
        userId: req.user?._id,
        role: req.user?.role,
      });
      return res.status(403).json({ message: "Forbidden" });
    }

    const contacts = await Contact.find()
      .populate("customerId", "name email companyName")
      .populate("projectId", "jobId site address")
      .populate("conversation.userId", "name email")
      .sort({ createdAt: -1 });

    return res.json({ success: true, result: contacts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.listCustomerContacts = async (req, res) => {
  try {
    const filter = getCustomerContactFilter(req.user);
    const contacts = await Contact.find(filter)
      .populate("projectId", "jobId site address")
      .populate("conversation.userId", "name email")
      .sort({ createdAt: -1 });

    return res.json({ success: true, result: contacts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.replyContact = async (req, res) => {
  try {
    if (!isCustomerUser(req.user)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const contactId = req.params.id;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const filter = getCustomerContactFilter(req.user);
    const contact = await Contact.findOne({ _id: contactId, ...filter });
    if (!contact) {
      return res.status(404).json({ message: "Contact request not found" });
    }

    contact.conversation.push({
      sender: "customer",
      userId: req.user._id,
      message,
    });
    contact.status = "In Progress";

    await contact.save();

    return res.json({ success: true, result: contact, message: "Reply added successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.respondContact = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const contactId = req.params.id;
    const { response, status } = req.body;

    const contact = await Contact.findById(contactId);
    if (!contact) {
      return res.status(404).json({ message: "Contact request not found" });
    }

    if (status) {
      contact.status = status;
    }

    if (response !== undefined) {
      contact.response = response;
      contact.respondedBy = req.user._id;
      contact.respondedAt = new Date();
      contact.conversation.push({
        sender: "admin",
        userId: req.user._id,
        message: response,
      });
    }

    await contact.save();

    return res.json({ success: true, result: contact, message: "Contact response saved" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};