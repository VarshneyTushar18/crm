const PaymentMode = require("../models/appModels/PaymentMode");

const DEFAULT_PAYMENT_MODES = [
  { name: "Bank Transfer", description: "Direct bank transfer", isDefault: true },
  { name: "Cheque", description: "Cheque payment", isDefault: false },
  { name: "Cash", description: "Cash payment", isDefault: false },
  { name: "Credit Card", description: "Credit or debit card payment", isDefault: false },
];

const CANONICAL_PAYMENT_MODE_NAMES = DEFAULT_PAYMENT_MODES.map((m) => m.name);

const LEGACY_NAME_MAP = {
  Check: "Cheque",
  Cheque: "Cheque",
  "Default Payment": null, // remove from active list
};

async function softRemoveMode(mode) {
  if (!mode || mode.removed) return;
  mode.removed = true;
  mode.enabled = false;
  mode.isDefault = false;
  await mode.save();
}

async function ensureDefaultPaymentModes() {
  // Rename legacy "Check" → "Cheque" when needed
  const legacyCheck = await PaymentMode.findOne({ name: "Check", removed: false });
  const existingCheque = await PaymentMode.findOne({ name: "Cheque", removed: false });
  if (legacyCheck) {
    if (!existingCheque) {
      legacyCheck.name = "Cheque";
      legacyCheck.description = legacyCheck.description || "Cheque payment";
      legacyCheck.enabled = true;
      await legacyCheck.save();
    } else {
      await softRemoveMode(legacyCheck);
    }
  }

  // Soft-remove known non-canonical leftovers
  const staleModes = await PaymentMode.find({
    removed: false,
    name: { $nin: CANONICAL_PAYMENT_MODE_NAMES },
  });
  for (const stale of staleModes) {
    // Keep unknown custom modes disabled from UI by soft-remove only for clear legacy defaults
    if (stale.name === "Default Payment" || LEGACY_NAME_MAP[stale.name] === null) {
      await softRemoveMode(stale);
    }
  }

  const modes = [];
  for (const spec of DEFAULT_PAYMENT_MODES) {
    const matches = await PaymentMode.find({ name: spec.name, removed: false }).sort({ created: 1 });
    let mode = matches[0];

    // Soft-remove duplicate names (keep oldest)
    for (let i = 1; i < matches.length; i += 1) {
      await softRemoveMode(matches[i]);
    }

    if (!mode) {
      mode = await PaymentMode.create({
        ...spec,
        enabled: true,
      });
    } else {
      let dirty = false;
      if (mode.enabled === false) {
        mode.enabled = true;
        dirty = true;
      }
      if (!mode.description || mode.description !== spec.description) {
        mode.description = spec.description;
        dirty = true;
      }
      if (Boolean(mode.isDefault) !== Boolean(spec.isDefault)) {
        mode.isDefault = Boolean(spec.isDefault);
        dirty = true;
      }
      if (dirty) await mode.save();
    }
    modes.push(mode);
  }

  // Ensure only Bank Transfer is default
  await PaymentMode.updateMany(
    { name: { $ne: "Bank Transfer" }, removed: false, isDefault: true },
    { $set: { isDefault: false } }
  );

  return modes;
}

function sortCanonicalPaymentModes(modes = []) {
  const order = new Map(CANONICAL_PAYMENT_MODE_NAMES.map((name, index) => [name, index]));
  return [...modes]
    .filter((mode) => mode && mode.removed !== true && mode.enabled !== false)
    .filter((mode) => CANONICAL_PAYMENT_MODE_NAMES.includes(mode.name))
    .sort((a, b) => (order.get(a.name) ?? 99) - (order.get(b.name) ?? 99));
}

module.exports = {
  DEFAULT_PAYMENT_MODES,
  CANONICAL_PAYMENT_MODE_NAMES,
  ensureDefaultPaymentModes,
  sortCanonicalPaymentModes,
};
