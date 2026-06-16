import { useEffect, useState } from "react";
import { Card, Form, Input, Button, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import axios from "axios";
import { API_BASE_URL, BASE_URL } from '@/config/serverApiConfig';

const API_BASE = API_BASE_URL;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function CompanySettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

  const loadPublic = async () => {
    try {
      const res = await axios.get(`${API_BASE}/settings/public`);
      const s = res.data?.result;
      form.setFieldsValue({ companyName: s?.companyName || "" });
      setLogoUrl(s?.logoUrl || "");
    } catch (err) {}
  };

  useEffect(() => {
    loadPublic();
  }, []);

  const onSaveCompanyName = async (values) => {
    setLoading(true);
    try {
      const res = await axios.patch(
        `${API_BASE}/settings/company`,
        { companyName: values.companyName },
        { headers: authHeaders() }
      );
      message.success(res.data?.message || "Company name updated");
      await loadPublic();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const uploadProps = {
    accept: "image/*",
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      setLogoUploading(true);
      try {
        const fd = new FormData();
        fd.append("logo", file);

        const res = await axios.post(`${API_BASE}/settings/logo`, fd, {
          headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
        });

        message.success(res.data?.message || "Logo updated");
        await loadPublic();
        onSuccess("ok");
      } catch (err) {
        message.error(err?.response?.data?.message || err?.message || "Upload failed");
        onError(err);
      } finally {
        setLogoUploading(false);
      }
    },
  };

  return (
    <div style={{ padding: 16 }}>
      <Card title="Company Settings" loading={loading}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              overflow: "hidden",
              background: "#f0f0f0",
              display: "grid",
              placeItems: "center",
            }}
          >
            {logoUrl ? (
              <img
                src={`${BASE_URL}${logoUrl}`}
                alt="logo"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{ fontWeight: 800 }}>LOGO</div>
            )}
          </div>

          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />} loading={logoUploading}>
              Upload Logo
            </Button>
          </Upload>
        </div>

        <Form form={form} layout="vertical" onFinish={onSaveCompanyName}>
          <Form.Item label="Company Name" name="companyName" rules={[{ required: true, message: "Company name required" }]}>
            <Input placeholder="Enter company name" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading}>
            Save
          </Button>
        </Form>
      </Card>
    </div>
  );
}