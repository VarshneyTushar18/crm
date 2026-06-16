import { useState } from "react";
import { Card, Form, Input, Button, Radio, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDispatch } from "react-redux";
import { UserOutlined, LockOutlined, IdcardOutlined, MailOutlined } from "@ant-design/icons";
import { API_BASE_URL } from '@/config/serverApiConfig';

const { Title, Text } = Typography;

const API = `${API_BASE_URL}/auth/login`;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("admin");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const onFinish = async (values) => {
    try {
      setLoading(true);

      const payload = {
        role: values.role,
        identifier: values.identifier?.trim(),
        password: values.password,
      };

      const res = await axios.post(API, payload);
      const data = res?.data;

      if (!data?.success) {
        message.error(data?.message || "Login failed");
        return;
      }

      const token = data?.result?.token;
      const user = data?.result?.user;

      if (!token || !user) {
        message.error("Login response missing token/user");
        return;
      }

      const authUser = { ...user, token };

      localStorage.setItem("token", token);
      localStorage.setItem("authToken", token);
      localStorage.setItem("jwt", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("currentUser", JSON.stringify(user));

      localStorage.setItem(
        "auth",
        JSON.stringify({
          current: authUser,
          token,
          user,
          isLoggedIn: true,
          loggedIn: true,
          role: user.role,
        })
      );

      axios.defaults.headers.common.Authorization = `Bearer ${token}`;

      const authPayload = {
        token,
        user,
        current: authUser,
        isLoggedIn: true,
        loggedIn: true,
        role: user.role,
      };

      dispatch({ type: "AUTH_SUCCESS", payload: authPayload });
      dispatch({ type: "LOGIN_SUCCESS", payload: authPayload });
      dispatch({ type: "AUTH_LOGIN_SUCCESS", payload: authPayload });

      message.success("Login successful");

      if (user.role === "admin") navigate("/admin/dashboard", { replace: true });
      else if (user.role === "worker") navigate("/worker", { replace: true });
      else navigate("/portal", { replace: true });
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Network error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "#f0f2f5",
      }}
    >
      <Card 
        style={{ 
          width: "100%",
          maxWidth: 400, 
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        }}
        bodyStyle={{ padding: "32px 24px" }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 4, color: "#1677ff" }}>
            Bright CRM
          </Title>
          <Text type="secondary">Sign in to your account</Text>
        </div>

        <Form 
          layout="vertical" 
          onFinish={onFinish} 
          initialValues={{ role: "admin" }}
          requiredMark={false}
        >
          <Form.Item
            name="role"
            rules={[{ required: true, message: "Please select your role" }]}
            style={{ marginBottom: 24 }}
          >
            <Radio.Group 
              onChange={(e) => setRole(e.target.value)} 
              buttonStyle="solid" 
              style={{ width: "100%", display: "flex" }}
            >
              <Radio.Button value="admin" style={{ flex: 1, textAlign: "center" }}>Admin</Radio.Button>
              <Radio.Button value="worker" style={{ flex: 1, textAlign: "center" }}>Employee</Radio.Button>
              <Radio.Button value="customer" style={{ flex: 1, textAlign: "center" }}>Customer</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label={role === "worker" ? "Worker ID" : "Email Address"}
            name="identifier"
            rules={[
              {
                required: true,
                message: role === "worker" ? "Please enter your Worker ID" : "Please enter your email",
              },
            ]}
          >
            <Input 
              prefix={role === "worker" ? <IdcardOutlined /> : <MailOutlined />}
              placeholder={role === "worker" ? "e.g. WRK-001" : "name@email.com"} 
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Please enter your password" }]}
            style={{ marginBottom: 8 }}
          >
            <Input.Password 
              prefix={<LockOutlined />}
              placeholder="Enter password" 
              size="large"
            />
          </Form.Item>

          <div style={{ textAlign: "right", marginBottom: 24 }}>
            <Text
              style={{ cursor: "pointer", color: "#1677ff" }}
              onClick={() => navigate("/forgot-password")}
            >
              Forgot password?
            </Text>
          </div>

          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading} 
            block 
            size="large"
            style={{ height: 45, fontWeight: 600 }}
          >
            Sign In
          </Button>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <Text type="secondary">
              Don't have a customer account?{" "}
              <span
                style={{ cursor: "pointer", color: "#1677ff", fontWeight: 500 }}
                onClick={() => navigate("/register")}
              >
                Sign Up
              </span>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
}