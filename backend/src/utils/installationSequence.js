const sortInstallationItems = (items = []) =>
  [...items].sort((a, b) => {
    const orderA = Number(a.sequenceOrder || 0);
    const orderB = Number(b.sequenceOrder || 0);
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });

const getPriorIncompleteSteps = (items = [], targetItem) => {
  if (!targetItem) return [];

  const sorted = sortInstallationItems(items);
  const targetOrder = Number(targetItem.sequenceOrder || 0);

  return sorted.filter(
    (item) =>
      String(item._id) !== String(targetItem._id) &&
      Number(item.sequenceOrder || 0) < targetOrder &&
      item.status !== "Completed"
  );
};

const validateInstallationStatusChange = (items = [], targetItem, nextStatus) => {
  if (!["In Progress", "Completed"].includes(nextStatus)) {
    return { ok: true };
  }

  const blockedBy = getPriorIncompleteSteps(items, targetItem);
  if (!blockedBy.length) return { ok: true };

  const labels = blockedBy
    .map((item) => `Step ${item.sequenceOrder}: ${item.activityName}`)
    .join(", ");

  return {
    ok: false,
    message: `Complete prior installation steps first: ${labels}`,
    blockedBy,
  };
};

const getNextSequenceOrder = (items = []) => {
  if (!items.length) return 1;
  const max = Math.max(...items.map((item) => Number(item.sequenceOrder || 0)));
  return max + 1;
};

module.exports = {
  sortInstallationItems,
  getPriorIncompleteSteps,
  validateInstallationStatusChange,
  getNextSequenceOrder,
};
