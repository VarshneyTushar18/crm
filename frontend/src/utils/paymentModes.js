/** Canonical payment mode labels shared by admin + customer portal UIs */
export const CANONICAL_PAYMENT_MODE_NAMES = [
  "Bank Transfer",
  "Cheque",
  "Cash",
  "Credit Card",
];

export function sortCanonicalPaymentModes(modes = []) {
  const order = new Map(CANONICAL_PAYMENT_MODE_NAMES.map((name, index) => [name, index]));
  return [...modes]
    .filter((mode) => mode && mode.removed !== true && mode.enabled !== false)
    .filter((mode) => CANONICAL_PAYMENT_MODE_NAMES.includes(mode.name))
    .sort((a, b) => (order.get(a.name) ?? 99) - (order.get(b.name) ?? 99));
}
