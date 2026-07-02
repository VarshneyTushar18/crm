import { useState } from "react";
import { Card, Form, Input, Button, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDispatch } from "react-redux";
import {
  UserOutlined,
  LockOutlined,
  IdcardOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  AuditOutlined,
} from "@ant-design/icons";
import BrandLogo from "@/components/BrandLogo";
import { API_BASE_URL } from "@/config/serverApiConfig";
import "./login.css";

const { Title, Text } = Typography;

const API = `${API_BASE_URL}/auth/login`;

const ROLE_OPTIONS = [
  {
    value: "admin",
    label: "Admin",
    hint: "Full access",
    description: "Manage leads, jobs, settings, and all modules.",
    icon: <SafetyCertificateOutlined />,
  },
  {
    value: "siteEngineer",
    label: "Site Engineer",
    hint: "Approvals",
    description: "Review drawings and approve jobs created by admin.",
    icon: <AuditOutlined />,
  },
  {
    value: "worker",
    label: "Employee",
    hint: "Field staff",
    description: "Sign in with worker ID or email for assigned tasks.",
    icon: <TeamOutlined />,
  },
  {
    value: "customer",
    label: "Customer",
    hint: "Portal",
    description: "View project progress, quotes, and invoices.",
    icon: <UserOutlined />,
  },
];

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("admin");
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const activeRole = ROLE_OPTIONS.find((r) => r.value === role) || ROLE_OPTIONS[0];

  const selectRole = (nextRole) => {
    setRole(nextRole);
    form.setFieldsValue({ role: nextRole });
  };

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
      else if (user.role === "siteEngineer") navigate("/admin/site-engineer", { replace: true });
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
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        <div className="login-brand">
          <BrandLogo variant="login" />
          <Text type="secondary" style={{ display: "block", marginTop: 12 }}>
            Sign in to your account
          </Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ role: "admin" }}
          requiredMark={false}
        >
          <Form.Item name="role" hidden>
            <Input />
          </Form.Item>

          <span className="login-role-label">I am signing in as</span>
          <div className="login-role-grid" role="radiogroup" aria-label="Sign-in role">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={role === option.value}
                className={`login-role-tile${role === option.value ? " login-role-tile--active" : ""}`}
                onClick={() => selectRole(option.value)}
              >
                <span className="login-role-tile__icon">{option.icon}</span>
                <span className="login-role-tile__name">{option.label}</span>
                <span className="login-role-tile__hint">{option.hint}</span>
              </button>
            ))}
          </div>
          <Text className="login-role-desc">{activeRole.description}</Text>

          <Form.Item
            label={role === "worker" ? "Worker ID or Email" : "Email Address"}
            name="identifier"
            rules={[
              {
                required: true,
                message:
                  role === "worker"
                    ? "Please enter your worker ID or email"
                    : "Please enter your email",
              },
            ]}
          >
            <Input
              prefix={role === "worker" ? <IdcardOutlined /> : <MailOutlined />}
              placeholder={
                role === "worker" ? "e.g. W-1001 or worker@crm.com" : "name@email.com"
              }
              size="large"
              autoComplete="username"
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
              autoComplete="current-password"
            />
          </Form.Item>

          <div style={{ textAlign: "right", marginBottom: 20 }}>
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
            style={{ height: 46, fontWeight: 600, borderRadius: 8 }}
          >
            Sign In
          </Button>

          {role === "customer" ? (
            <div className="login-footer">
              <Text type="secondary">
                Don&apos;t have an account?{" "}
                <span
                  style={{ cursor: "pointer", color: "#1677ff", fontWeight: 500 }}
                  onClick={() => navigate("/register")}
                >
                  Sign Up
                </span>
              </Text>
            </div>
          ) : null}

          <div className="login-portal-link">
            <Text type="secondary" style={{ fontSize: 12 }}>
              Customer? You can also use the{" "}
              <span
                style={{ cursor: "pointer", color: "#1677ff", fontWeight: 500 }}
                onClick={() => navigate("/portal/login")}
              >
                dedicated portal login
              </span>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
}
