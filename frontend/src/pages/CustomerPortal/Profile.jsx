import { useEffect, useState } from "react";
import { Card, Form, Input, Button, message, Space, Descriptions, Divider, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import PasswordModal from "./PasswordModal";

const { Text } = Typography;

export default function Profile() {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [me, setMe] = useState(null);

  const loadMe = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get("/api/user/me");
      const user = res.data?.result;
      setMe(user);

      form.setFieldsValue({
        name: user?.name || "",
        companyName: user?.companyName || "",
        email: user?.email || "",
        mobile: user?.mobile || "",
      });
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe();
  }, []);

  const onSave = async (values) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        email: values.email,
      };

      if (me?.role === "customer") {
        payload.companyName = values.companyName;
        payload.mobile = values.mobile;
      }

      const res = await axiosClient.patch("/api/user/me", payload);
      message.success(res.data?.message || "Profile updated");

      setEditing(false);
      await loadMe();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };


  const onLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/portal/login", { replace: true });
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
      <Card
        title="Customer Profile"
        loading={loading}
        extra={
          <Space>
            {!editing ? (
              <Button onClick={() => setEditing(true)}>Edit Profile</Button>
            ) : (
              <Button
                onClick={() => {
                  setEditing(false);
                  loadMe();
                }}
              >
                Cancel
              </Button>
            )}
            <Button danger onClick={onLogout}>
              Logout
            </Button>
          </Space>
        }
      >
        <Text type="secondary">Update your customer account details and keep your login secure.</Text>

        <Divider />

        {!editing && me && (
          <Descriptions bordered column={1} size="middle">
            <Descriptions.Item label="Name">{me.name || "-"}</Descriptions.Item>
            <Descriptions.Item label="Role">{me.role || "-"}</Descriptions.Item>
            {me.role === "customer" && (
              <>
                <Descriptions.Item label="Company Name">{me.companyName || "-"}</Descriptions.Item>
                <Descriptions.Item label="Mobile">{me.mobile || "-"}</Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="Email">{me.email || "-"}</Descriptions.Item>
            <Descriptions.Item label="Active">{me.isActive ? "Yes" : "No"}</Descriptions.Item>
            <Descriptions.Item label="Joined">{me.createdAt ? new Date(me.createdAt).toLocaleString() : "-"}</Descriptions.Item>
          </Descriptions>
        )}

        {editing && (
          <Form form={form} layout="vertical" onFinish={onSave} style={{ marginTop: 16 }}>
            <Form.Item label="Name" name="name" rules={[{ required: true, message: "Name is required" }]}> 
              <Input placeholder="Enter your full name" />
            </Form.Item>

            {me?.role === "customer" && (
              <Form.Item
                label="Company Name"
                name="companyName"
                rules={[{ required: true, message: "Company name is required" }]}
              >
                <Input placeholder="Enter your company name" />
              </Form.Item>
            )}

            <Form.Item
              label="Email"
              name="email"
              rules={[{ required: true, type: "email", message: "A valid email is required" }]}
            >
              <Input placeholder="Enter your email address" />
            </Form.Item>

            {me?.role === "customer" && (
              <Form.Item
                label="Mobile"
                name="mobile"
                rules={[{ required: true, message: "Mobile number is required" }]}
              >
                <Input placeholder="Enter your mobile number" />
              </Form.Item>
            )}

            <Button type="primary" htmlType="submit" loading={saving}>
              Save Profile
            </Button>
          </Form>
        )}
      </Card>

      <Card title="Security & Password" style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            Manage your account security by updating your portal password. You can verify your identity using your current password, phone OTP, or email OTP.
          </Text>
          <Button 
            type="primary" 
            onClick={() => setPasswordModalOpen(true)}
            style={{ marginTop: 16 }}
          >
            Manage Password
          </Button>
        </Space>
      </Card>

      <PasswordModal 
        isOpen={passwordModalOpen} 
        onClose={() => setPasswordModalOpen(false)} 
      />
    </div>
  );
}
