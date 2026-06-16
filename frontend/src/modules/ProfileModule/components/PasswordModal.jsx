import React, { useState, useEffect } from 'react';
import { useProfileContext } from '@/context/profileContext';
import useOnFetch from '@/hooks/useOnFetch';
import { request } from '@/request';
import { Form, Input, Modal, Tabs, Button, message, Space, Typography } from 'antd';
import { LockOutlined, MobileOutlined, MailOutlined } from '@ant-design/icons';
import useLanguage from '@/locale/useLanguage';

const { Text } = Typography;

const PasswordModal = () => {
  const translate = useLanguage();
  const { state, profileContextAction } = useProfileContext();
  const { modal } = profileContextAction;
  const { passwordModal } = state;

  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('password');
  const [isOTPSent, setIsOTPSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { onFetch, isLoading } = useOnFetch();

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOTP = async () => {
    try {
      const res = await request.post({
        entity: 'admin/profile/password/request-otp',
        jsonData: { method: activeTab === 'phoneOTP' ? 'phone' : 'email' },
      });
      if (res.success) {
        message.success(res.message);
        setIsOTPSent(true);
        setCountdown(60);
      }
    } catch (err) {
      message.error(err.message || 'Failed to send verification code');
    }
  };

  const onFinish = async (values) => {
    const payload = {
      ...values,
      mode: activeTab,
    };

    const updateFn = async () => {
      return await request.patch({
        entity: 'admin/profile/password',
        jsonData: payload,
      });
    };

    try {
      const res = await onFetch(updateFn());
      if (res) {
        form.resetFields();
        setIsOTPSent(false);
        setCountdown(0);
        modal.close();
      }
    } catch (err) {
      // Error is handled by hook
    }
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    setIsOTPSent(false);
    setCountdown(0);
    form.resetFields(['otp', 'oldPassword']);
  };

  const items = [
    {
      key: 'password',
      label: (
        <span>
          <LockOutlined /> {translate('Old Password')}
        </span>
      ),
      children: (
        <Form.Item
          label={translate('Current Password')}
          name="oldPassword"
          rules={[{ required: activeTab === 'password', message: 'Current password is required' }]}
        >
          <Input.Password prefix={<LockOutlined />} />
        </Form.Item>
      ),
    },
    {
      key: 'phoneOTP',
      label: (
        <span>
          <MobileOutlined /> {translate('Phone OTP')}
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">Verification code will be sent to your registered mobile number.</Text>
          <Form.Item
            label={translate('Verification Code')}
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
          <MailOutlined /> {translate('Email OTP')}
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">Verification code will be sent to your registered email address.</Text>
          <Form.Item
            label={translate('Verification Code')}
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
      title={translate('Security Verification & Password Update')}
      open={passwordModal.isOpen}
      onCancel={() => {
        form.resetFields();
        modal.close();
      }}
      okText={translate('Update Password')}
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
            label={translate('New Password')}
            name="password"
            rules={[
              { required: true, message: 'New password is required' },
              { min: 8, message: 'Minimum 8 characters' },
            ]}
            hasFeedback
          >
            <Input.Password />
          </Form.Item>
          
          <Form.Item
            label={translate('Confirm Password')}
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
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default PasswordModal;
