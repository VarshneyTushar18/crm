import { Typography } from "antd";
import WorkerTasksTab from "@/pages/Worker/WorkerTasksTab";

const { Title, Text } = Typography;

export default function WorkerTasksPage() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  return (
    <div className="page-shell">
      <Title level={3} style={{ marginBottom: 4 }}>My Tasks</Title>
      <Text type="secondary">Tasks assigned to {user?.name || "you"} from admin.</Text>
      <div style={{ marginTop: 16 }}>
        <WorkerTasksTab />
      </div>
    </div>
  );
}
