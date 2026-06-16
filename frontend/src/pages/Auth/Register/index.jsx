import { useState } from "react";
import { Card, Form, Input, Button, Typography, message } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { registerCustomerApi } from "../Login/authApi";

const { Title, Text } = Typography;

// ✅ Password rules:
// min 8, 1 upper, 1 lower, 1 number, 1 special
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#()_\-+=\[\]{};:'",.<>\/\\|`~])[A-Za-z\d@$!%*?&^#()_\-+=\[\]{};:'",.<>\/\\|`~]{8,}$/;

export default function Register() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    try {
      setLoading(true);

      // ✅ send required fields to backend
      const payload = {
        name: values.name?.trim(),
        companyName: values.companyName?.trim(),
        email: values.email?.trim(),
        password: values.password,
        mobile: values.mobile?.trim(),
      };
      const data = await registerCustomerApi(payload);

      if (data?.success === false) {
        throw new Error(data?.message || "Registration failed");
      }

      message.success("Account created successfully. Please login.");
      navigate("/login", { replace: true });
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b1220",
        padding: 16,
      }}
    >
      <Card style={{ width: 460, borderRadius: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <Title level={3} style={{ margin: 0 }}>
            Customer Sign Up
          </Title>
          <Text type="secondary">Create your customer account</Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
        >
          {/* ✅ Name */}
          <Form.Item
            label="Full Name"
            name="name"
            rules={[{ required: true, message: "Full Name is required" }]}
          >
            <Input placeholder="Enter your name" />
          </Form.Item>

          {/* ✅ Company Name */}
          <Form.Item
            label="Company Name"
            name="companyName"
            rules={[{ required: true, message: "Company Name is required" }]}
          >
            <Input placeholder="Enter company name" />
          </Form.Item>

          {/* ✅ Email */}
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Enter a valid email" },
            ]}
          >
            <Input placeholder="you@company.com" />
          </Form.Item>

          {/* ✅ Password */}
          <Form.Item
            label="Password"
            name="password"
            rules={[
              { required: true, message: "Password is required" },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (PASSWORD_REGEX.test(value)) return Promise.resolve();

                  return Promise.reject(
                    new Error(
                      "Password must be 8+ chars with 1 uppercase, 1 lowercase, 1 number, and 1 special character"
                    )
                  );
                },
              },
            ]}
            hasFeedback
          >
            <Input.Password placeholder="Create strong password" />
          </Form.Item>

          {/* ✅ Confirm Password */}
          <Form.Item
            label="Confirm Password"
            name="confirmPassword"
            dependencies={["password"]}
            hasFeedback
            rules={[
              { required: true, message: "Confirm Password is required" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Re-enter password" />
          </Form.Item>

          {/* ✅ Other mandatory field (example: Mobile Number) */}
          <Form.Item
            label="Mobile Number"
            name="mobile"
            rules={[
              { required: true, message: "Mobile Number is required" },
              {
                pattern: /^[0-9]{10}$/,
                message: "Enter valid 10 digit mobile number",
              },
            ]}
          >
            <Input placeholder="10 digit mobile number" maxLength={10} />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            Create account
          </Button>

          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between" }}>
            <Link to="/login">Back to login</Link>
            <Text type="secondary">All fields are mandatory</Text>
          </div>
        </Form>
      </Card>
    </div>
  );
}
