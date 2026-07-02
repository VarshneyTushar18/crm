const Notification = require("../models/appModels/Notification");
const User = require("../models/appModels/User");
const Customer = require("../models/appModels/Customer");

const NOTIFICATION_RETENTION_MS = 24 * 60 * 60 * 1000;

const getUserId = (req) =>
  req.user?._id || req.admin?._id || req.auth?._id || null;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const getRetentionCutoff = () => new Date(Date.now() - NOTIFICATION_RETENTION_MS);

const retentionFilter = () => ({
  createdAt: { $gte: getRetentionCutoff() },
});

const resolveCustomerForUser = async (user) => {
  if (!user) return null;

  if (user.customer) {
    const linked = await Customer.findById(user.customer);
    if (linked) return linked;
  }

  if (user.email) {
    const byPortal = await Customer.findOne({
      portalEmail: normalizeEmail(user.email),
    }).sort({ createdAt: -1 });
    if (byPortal) return byPortal;

    const byEmail = await Customer.findOne({
      email: normalizeEmail(user.email),
    }).sort({ createdAt: -1 });
    if (byEmail) return byEmail;
  }

  return null;
};

const buildListFilter = async (req) => {
  const userId = getUserId(req);
  const role = String(req.user?.role || "admin").toLowerCase();

  if (role === "customer") {
    const user = userId ? await User.findById(userId) : null;
    const customer = await resolveCustomerForUser(user);
    if (!customer) {
      return { _id: null };
    }
    return { customerId: customer._id };
  }

  return {
    $or: [{ userId }, { userId: null, role: { $in: [role, "all"] } }],
  };
};

const purgeExpiredNotifications = async (scopeFilter) => {
  try {
    await Notification.deleteMany({
      ...scopeFilter,
      createdAt: { $lt: getRetentionCutoff() },
    });
  } catch {
    // Non-blocking cleanup.
  }
};

const findOwnedNotification = async (req, id) => {
  const scopeFilter = await buildListFilter(req);
  return Notification.findOne({
    _id: id,
    ...scopeFilter,
    ...retentionFilter(),
  });
};

exports.list = async (req, res) => {
  try {
    const scopeFilter = await buildListFilter(req);
    const filter = { ...scopeFilter, ...retentionFilter() };

    purgeExpiredNotifications(scopeFilter);

    const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(100);
    const unreadCount = await Notification.countDocuments({ ...filter, read: false });

    return res.json({
      success: true,
      result: {
        items,
        unreadCount,
        retentionHours: 24,
        expiresAt: new Date(Date.now() + NOTIFICATION_RETENTION_MS).toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const owned = await findOwnedNotification(req, req.params.id);
    if (!owned) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    if (!owned.read) {
      owned.read = true;
      owned.readAt = new Date();
      await owned.save();
    }

    return res.json({ success: true, result: owned });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const scopeFilter = await buildListFilter(req);
    const filter = { ...scopeFilter, ...retentionFilter(), read: false };

    const result = await Notification.updateMany(filter, {
      read: true,
      readAt: new Date(),
    });

    return res.json({
      success: true,
      message: "All notifications marked as read",
      result: { modifiedCount: result.modifiedCount || 0 },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
