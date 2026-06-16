import { useState } from "react";
import { Card, Form, Input, Button, Typography, message } from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import { resetPasswordApi } from "../Login/authApi";

const { Title, Text } = Typography;

export default function ResetPassword() {
  const [loading, setLoading] = useState(false);
  const { token } = useParams();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const data = await resetPasswordApi({ token, newPassword: values.newPassword });

      if (data?.success === false) throw new Error(data?.message || "Reset failed");

      message.success("Password updated. Please login.");
      navigate("/login", { replace: true });
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b1220", padding: 16 }}>
      <Card style={{ width: 420, borderRadius: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <Title level={3} style={{ margin: 0 }}>Reset Password</Title>
          <Text type="secondary">Set your new password</Text>
        </div>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="New Password" name="newPassword" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            Update password
          </Button>

          <div style={{ marginTop: 10 }}>
            <Link to="/login">Back to login</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
