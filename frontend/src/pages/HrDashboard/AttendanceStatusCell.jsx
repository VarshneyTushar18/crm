import { Tooltip } from "antd";
import {
  CheckCircleFilled,
  CloseCircleOutlined,
  InfoCircleFilled,
  StarFilled,
  StarOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { CELL_STATUS } from "./attendanceMatrixUtils";

const ICONS = {
  [CELL_STATUS.HOLIDAY]: {
    icon: <StarFilled style={{ color: "#faad14", fontSize: 16 }} />,
    title: "Holiday",
  },
  [CELL_STATUS.PRESENT]: {
    icon: <CheckCircleFilled style={{ color: "#339393", fontSize: 16 }} />,
    title: "Present",
  },
  [CELL_STATUS.HALF]: {
    icon: <StarOutlined style={{ color: "#339393", fontSize: 16 }} />,
    title: "Half Day",
  },
  [CELL_STATUS.LATE]: {
    icon: <InfoCircleFilled style={{ color: "#339393", fontSize: 16 }} />,
    title: "Late",
  },
  [CELL_STATUS.ABSENT]: {
    icon: <CloseCircleOutlined style={{ color: "#bfbfbf", fontSize: 16 }} />,
    title: "Absent",
  },
  [CELL_STATUS.LEAVE]: {
    icon: <SendOutlined style={{ color: "#ff4d4f", fontSize: 15 }} />,
    title: "On Leave",
  },
  [CELL_STATUS.FUTURE]: {
    icon: null,
    title: "",
  },
};

export default function AttendanceStatusCell({ detail }) {
  const status = detail?.status || CELL_STATUS.FUTURE;
  const meta = ICONS[status];
  if (!meta?.icon) {
    return <span style={{ display: "inline-block", width: 16, height: 16 }} />;
  }

  const record = detail?.record;
  let tip = meta.title;
  if (record) {
    tip = `${meta.title} — In ${record.checkin || "—"}, Out ${record.checkout || "—"}`;
  } else if (detail?.dateStr) {
    tip = `${meta.title} — ${detail.dateStr}`;
  }

  return (
    <Tooltip title={tip}>
      <span style={{ display: "inline-flex", justifyContent: "center", width: "100%" }}>
        {meta.icon}
      </span>
    </Tooltip>
  );
}
