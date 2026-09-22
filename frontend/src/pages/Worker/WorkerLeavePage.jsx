import { Typography } from "antd";
import WorkerLeaveTab from "@/pages/Worker/WorkerLeaveTab";

const { Title, Text } = Typography;

export default function WorkerLeavePage() {
  return (
    <div className="page-shell">
      <Title level={3} style={{ marginBottom: 4 }}>My Leave</Title>
      <Text type="secondary">Request and track your leave.</Text>
      <div style={{ marginTop: 16 }}>
        <WorkerLeaveTab />
      </div>
    </div>
  );
}
