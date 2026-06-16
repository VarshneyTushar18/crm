import { useState } from "react";
import { Card, Form, Input, Button, Typography, message } from "antd";
import { Link } from "react-router-dom";
import { forgotPasswordApi } from "../Login/authApi";

const { Title, Text } = Typography;

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const data = await forgotPasswordApi({ email: values.email?.trim() });

      if (data?.success === false) throw new Error(data?.message || "Request failed");

      message.success("If email exists, reset link sent.");
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b1220", padding: 16 }}>
      <Card style={{ width: 420, borderRadius: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <Title level={3} style={{ margin: 0 }}>Forgot Password</Title>
          <Text type="secondary">Enter your email to receive reset link</Text>
        </div>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="Email" name="email" rules={[{ required: true }, { type: "email" }]}>
            <Input />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            Send reset link
          </Button>

          <div style={{ marginTop: 10 }}>
            <Link to="/login">Back to login</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
