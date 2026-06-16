import { Button, Typography, Row, Col } from "antd";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

export default function WorkerDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  const user = JSON.parse(localStorage.getItem("user") || "null");

  return (
    <div className="page-shell" style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Row justify="space-between" align="middle" gutter={[12, 12]}>
        <Col xs={24} sm={16}>
          <Title level={3} style={{ marginBottom: 4 }}>
            Worker Dashboard
          </Title>
          <Text>Welcome, {user?.name || "Worker"}</Text>
        </Col>

        <Col xs={24} sm={8} style={{ textAlign: "right" }}>
          <Button type="primary" danger block={false} onClick={handleLogout}>
            Logout
          </Button>
        </Col>
      </Row>

      <div style={{ marginTop: 20 }}>
        <Text>Worker task panel</Text>
      </div>
    </div>
  );
}
