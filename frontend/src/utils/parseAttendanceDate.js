import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

const ATTENDANCE_DATE_FORMAT = "DD-MM-YYYY";

/**
 * Parse attendance record dates stored as DD-MM-YYYY strings.
 */
export function parseAttendanceDate(dateStr) {
  if (!dateStr) return null;
  if (dayjs.isDayjs(dateStr)) return dateStr.isValid() ? dateStr : null;

  const trimmed = String(dateStr).trim();
  const strict = dayjs(trimmed, ATTENDANCE_DATE_FORMAT, true);
  if (strict.isValid()) return strict;

  const loose = dayjs(trimmed, ATTENDANCE_DATE_FORMAT);
  return loose.isValid() ? loose : null;
}

export { ATTENDANCE_DATE_FORMAT };
