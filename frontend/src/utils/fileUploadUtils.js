export const isPdfFile = (file) => {
  if (!file) return false;
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  if (name.endsWith(".pdf")) return true;
  return (
    type === "application/pdf" ||
    type === "application/x-pdf" ||
    type === "application/vnd.pdf"
  );
};
