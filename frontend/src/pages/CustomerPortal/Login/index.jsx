import { useState } from "react";
import { Card, Form, Input, Button, message, Typography } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import { customerLogin } from "../../../api/customerPortalApi";
import { useCustomerAuth } from "../../../context/CustomerAuthContext";

const { Title, Text } = Typography;

export default function CustomerLogin() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useCustomerAuth();

  const onFinish = async (values) => {
    setLoading(true);

    try {
      const payload = {
        role: "customer",
        identifier: values.email,
        password: values.password,
      };

      const data = await customerLogin(payload);

      const token = data?.result?.token;
      const user = data?.result?.user;
      const customer = user?.customer || null;

      if (!token) {
        throw new Error(data?.message || "Login failed");
      }

      login({
        token,
        customer,
        user,
      });

      // Save for ProtectedRoute validation
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("role", "customer");

      const redirectTo = location.state?.from || "/portal/dashboard";
      navigate(redirectTo, { replace: true });

      message.success("Customer login successful");
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "80vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <Card
        style={{
          width: 420,
          borderRadius: 12,
        }}
      >
        <Title level={3} style={{ marginBottom: 4 }}>
          Customer Login
        </Title>
        <Text type="secondary">
          Login to view your project details and updates.
        </Text>

        <Form layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "Email required" },
              { type: "email", message: "Invalid email" },
            ]}
          >
            <Input placeholder="customer@email.com" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Password required" }]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            Login
          </Button>
        </Form>
      </Card>
    </div>
  );
}