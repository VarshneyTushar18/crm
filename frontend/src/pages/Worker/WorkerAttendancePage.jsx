import { useEffect, useState } from "react";
import { Typography } from "antd";
import WorkerAttendanceHistory from "@/pages/Worker/WorkerAttendanceHistory";

const { Title, Text } = Typography;

export default function WorkerAttendancePage() {
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    const onAttendanceChanged = () => setHistoryKey((k) => k + 1);
    window.addEventListener("worker-attendance-changed", onAttendanceChanged);
    return () => window.removeEventListener("worker-attendance-changed", onAttendanceChanged);
  }, []);

  return (
    <div className="page-shell">
      <Title level={3} style={{ marginBottom: 4 }}>Attendance History</Title>
      <Text type="secondary">Your check-in and check-out records.</Text>
      <div style={{ marginTop: 16 }}>
        <WorkerAttendanceHistory key={historyKey} />
      </div>
    </div>
  );
}
