/** HR leave calendar — green / yellow / red */
export const LEAVE_STATUS_CELL_STYLES = {
  Approved: { background: "#dcfce7", color: "#15803d", fontWeight: 600 },
  Pending: { background: "#fef9c3", color: "#a16207", fontWeight: 600 },
  Rejected: { background: "#fee2e2", color: "#b91c1c", fontWeight: 600 },
};

export const WORKER_ATTENDANCE_CELL_STYLES = {
  present: { background: "#dcfce7", color: "#15803d", fontWeight: 600 },
  leave: { background: "#dbeafe", color: "#1d4ed8", fontWeight: 600 },
  absent: { background: "#fee2e2", color: "#b91c1c", fontWeight: 600 },
  weekend: { background: "#f1f5f9", color: "#64748b" },
};

export function leaveStatusCellStyle(status) {
  return LEAVE_STATUS_CELL_STYLES[status] || LEAVE_STATUS_CELL_STYLES.Pending;
}
