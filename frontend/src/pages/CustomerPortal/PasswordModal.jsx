import React, { useState, useEffect } from 'react';
import { Form, Input, Modal, Tabs, Button, message, Space, Typography } from 'antd';
import { LockOutlined, MobileOutlined, MailOutlined } from '@ant-design/icons';
import axiosClient from "../../api/axiosClient";

const { Text } = Typography;

const PasswordModal = ({ isOpen, onClose }) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('password');
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOTP = async () => {
    setIsLoading(true);
    try {
      const res = await axiosClient.post("/api/user/me/password/request-otp", {
        method: activeTab === 'phoneOTP' ? 'phone' : 'email',
      });
      if (res.data?.success) {
        message.success(res.data?.message);
        setCountdown(60);
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const onFinish = async (values) => {
    setIsLoading(true);
    try {
      const payload = {
        password: values.password,
        passwordCheck: values.passwordCheck,
        mode: activeTab,
        oldPassword: values.oldPassword,
        otp: values.otp,
      };

      const res = await axiosClient.patch("/api/user/me/password", payload);
      if (res.data?.success) {
        message.success("Password updated successfully");
        form.resetFields();
        setCountdown(0);
        onClose();
      }
    } catch (err) {
      message.error(err?.response?.data?.message || "Password update failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    setCountdown(0);
    form.resetFields(['otp', 'oldPassword']);
  };

  const items = [
    {
      key: 'password',
      label: (
        <span>
          <LockOutlined /> Current Password
        </span>
      ),
      children: (
        <Form.Item
          label="Current Password"
          name="oldPassword"
          rules={[{ required: activeTab === 'password', message: 'Current password is required' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Enter current password" />
        </Form.Item>
      ),
    },
    {
      key: 'phoneOTP',
      label: (
        <span>
          <MobileOutlined /> Phone OTP
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">Verification code will be sent to your registered mobile number.</Text>
          <Form.Item
            label="Verification Code"
            name="otp"
            rules={[{ required: activeTab === 'phoneOTP', message: 'OTP is required' }]}
          >
            <Space>
              <Input placeholder="6-digit code" style={{ width: 150 }} maxLength={6} />
              <Button onClick={handleSendOTP} disabled={countdown > 0} loading={isLoading}>
                {countdown > 0 ? `Resend (${countdown}s)` : 'Send Code'}
              </Button>
            </Space>
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'emailOTP',
      label: (
        <span>
          <MailOutlined /> Email OTP
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">Verification code will be sent to your registered email address.</Text>
          <Form.Item
            label="Verification Code"
            name="otp"
            rules={[{ required: activeTab === 'emailOTP', message: 'OTP is required' }]}
          >
            <Space>
              <Input placeholder="6-digit code" style={{ width: 150 }} maxLength={6} />
              <Button onClick={handleSendOTP} disabled={countdown > 0} loading={isLoading}>
                {countdown > 0 ? `Resend (${countdown}s)` : 'Send Code'}
              </Button>
            </Space>
          </Form.Item>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title="Security Verification & Password Update"
      open={isOpen}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      okText="Update Password"
      confirmLoading={isLoading}
      onOk={() => form.submit()}
      width={600}
    >
      <Typography.Paragraph>
        Choose a method to verify your identity before updating your password.
      </Typography.Paragraph>
      
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Tabs activeKey={activeTab} onChange={handleTabChange} items={items} />

        <div style={{ marginTop: 20, borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
          <Form.Item
            label="New Password"
            name="password"
            rules={[
              { required: true, message: 'New password is required' },
              { min: 8, message: 'Minimum 8 characters' },
            ]}
            hasFeedback
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
          
          <Form.Item
            label="Confirm Password"
            name="passwordCheck"
            hasFeedback
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('The two passwords that you entered do not match!'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default PasswordModal;
