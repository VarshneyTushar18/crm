export const SITE_ENGINEER_MENU_KEYS = new Set([
  "jobs",
  "scheduling",
  "site-engineer",
  "fabrication",
  "qc",
  "installation",
]);

export const SITE_ENGINEER_HOME = "/admin/site-engineer";

export const isSiteEngineerBlockedPath = (pathname = "") => {
  const path = pathname.replace(/\/$/, "") || "/admin";
  const blocked =
    path === "/admin" ||
    path === "/admin/dashboard" ||
    path.startsWith("/admin/material-purchase") ||
    path.startsWith("/admin/invoice") ||
    path.startsWith("/admin/payment") ||
    path.startsWith("/admin/purchase-orders") ||
    path.startsWith("/admin/rfq") ||
    path.startsWith("/admin/suppliers") ||
    path.startsWith("/admin/quotes") ||
    path.startsWith("/admin/quote") ||
    path.startsWith("/admin/lead") ||
    path.startsWith("/admin/settings") ||
    path.startsWith("/admin/employee") ||
    path.startsWith("/admin/attendance") ||
    path.startsWith("/admin/leave") ||
    path.startsWith("/admin/customer") ||
    path.startsWith("/admin/contact-requests") ||
    path.startsWith("/admin/sites") ||
    path.startsWith("/admin/kanban") ||
    path.startsWith("/admin/erp") ||
    path.startsWith("/admin/about") ||
    path.startsWith("/admin/planning") ||
    path.startsWith("/admin/site-measurement") ||
    path.startsWith("/admin/drafting");

  return blocked;
};
