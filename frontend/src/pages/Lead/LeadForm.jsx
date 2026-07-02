import { Modal, Form, Input, Select, Button, Space, Switch, Card } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getLeadSources } from '@/api/phase1Api';
import { getLeadAddresses, normalizeLeadAddresses } from './leadAddressUtils';

const { Option } = Select;

const ADDRESS_TYPES = ['Site', 'Office', 'Billing', 'Other'];

export default function LeadForm({ open, onCancel, onSubmit, initialValues }) {
  const [form] = Form.useForm();
  const [leadSources, setLeadSources] = useState(['Manual Entry']);

  useEffect(() => {
    getLeadSources()
      .then((res) => {
        if (res.data?.result?.length) setLeadSources(res.data.result);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      const initialPhones =
        initialValues?.phones?.length
          ? initialValues.phones
          : initialValues?.phone
            ? [{ label: 'Primary', number: initialValues.phone, isPrimary: true }]
            : [{ label: 'Primary', number: '', isPrimary: true }];

      const initialAddresses = getLeadAddresses(initialValues || {});
      const addresses =
        initialAddresses.length > 0
          ? initialAddresses
          : [{ type: 'Site', line1: '', line2: '', city: '', state: '', postcode: '', country: '', isPrimary: true }];

      form.setFieldsValue({
        leadSource: leadSources[0] || 'Manual Entry',
        status: 'New',
        ...initialValues,
        phones: initialPhones,
        addresses,
        siteAddress: initialValues?.siteAddress || '',
      });
    }
  }, [open, initialValues, form, leadSources]);

  const normalizeSubmit = (values) => {
    const phones = (values.phones || [])
      .map((p) => ({
        label: (p?.label || 'Other').trim(),
        number: (p?.number || '').trim(),
        isPrimary: !!p?.isPrimary,
      }))
      .filter((p) => p.number);

    if (!phones.length && values.phone) {
      phones.push({ label: 'Primary', number: values.phone, isPrimary: true });
    }
    if (phones.length && !phones.some((p) => p.isPrimary)) {
      phones[0].isPrimary = true;
    }

    const primaryPhone = phones.find((p) => p.isPrimary) || phones[0];
    const { addresses, siteAddress } = normalizeLeadAddresses(values);

    if (!siteAddress) {
      form.setFields([{ name: 'addresses', errors: ['At least one site address is required'] }]);
      return;
    }

    onSubmit({
      ...values,
      phones,
      phone: primaryPhone?.number || values.phone || '',
      addresses,
      siteAddress,
    });
  };

  return (
    <Modal
      title={initialValues?._id ? 'Edit Lead' : 'Add Lead'}
      open={open}
      onCancel={() => {
        onCancel();
        form.resetFields();
      }}
      onOk={() => form.submit()}
      okText="Save"
      width={760}
    >
      <Form form={form} layout="vertical" onFinish={normalizeSubmit}>
        <Form.Item
          name="clientName"
          label="Client Name"
          rules={[{ required: true, message: 'Client name is required' }]}
        >
          <Input placeholder="Enter client name" />
        </Form.Item>

        <Form.Item name="contactPerson" label="Contact Person">
          <Input placeholder="Enter contact person name" />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Phone"
          rules={[{ required: true, message: 'Phone is required' }]}
        >
          <Input placeholder="Enter phone number" />
        </Form.Item>

        <Form.List name="phones">
          {(fields, { add, remove }) => (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Additional Phone Numbers</div>
              {fields.map((field) => (
                <Space key={field.key} align="start" style={{ display: 'flex', marginBottom: 8 }}>
                  <Form.Item name={[field.name, 'label']} style={{ minWidth: 140, marginBottom: 0 }}>
                    <Input placeholder="Label (e.g. Site Manager)" />
                  </Form.Item>
                  <Form.Item name={[field.name, 'number']} style={{ minWidth: 220, marginBottom: 0 }}>
                    <Input placeholder="Phone number" />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'isPrimary']}
                    valuePropName="checked"
                    style={{ marginBottom: 0, marginTop: 4 }}
                  >
                    <Switch checkedChildren="Primary" unCheckedChildren="Alt" />
                  </Form.Item>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => remove(field.name)}
                  />
                </Space>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ label: 'Other', number: '', isPrimary: false })} block>
                Add Phone Number
              </Button>
            </div>
          )}
        </Form.List>

        <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Invalid email' }]}>
          <Input placeholder="Enter email" />
        </Form.Item>

        <Form.List name="addresses">
          {(fields, { add, remove }) => (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Addresses</div>
              {fields.map((field) => (
                <Card
                  key={field.key}
                  size="small"
                  style={{ marginBottom: 12 }}
                  extra={
                    fields.length > 1 ? (
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                    ) : null
                  }
                >
                  <Form.Item name={[field.name, 'type']} label="Type" style={{ marginBottom: 8 }}>
                    <Select
                      options={ADDRESS_TYPES.map((t) => ({ value: t, label: t }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'line1']}
                    label="Address Line 1"
                    rules={[{ required: true, message: 'Address line 1 is required' }]}
                  >
                    <Input placeholder="Street / building" />
                  </Form.Item>
                  <Form.Item name={[field.name, 'line2']} label="Address Line 2">
                    <Input placeholder="Unit, suite, etc." />
                  </Form.Item>
                  <Space wrap style={{ width: '100%' }}>
                    <Form.Item name={[field.name, 'city']} label="City / Suburb" style={{ minWidth: 160 }}>
                      <Input placeholder="City or suburb" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'state']} label="State" style={{ minWidth: 120 }}>
                      <Input placeholder="State" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'postcode']} label="Postcode" style={{ minWidth: 100 }}>
                      <Input placeholder="Postcode" />
                    </Form.Item>
                  </Space>
                  <Form.Item name={[field.name, 'country']} label="Country">
                    <Input placeholder="Country" />
                  </Form.Item>
                  <Form.Item name={[field.name, 'isPrimary']} label="Primary address" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Card>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => add({ type: 'Office', line1: '', line2: '', city: '', state: '', postcode: '', country: '', isPrimary: false })}
                block
              >
                Add Address
              </Button>
            </div>
          )}
        </Form.List>

        <Form.Item name="siteAddress" hidden>
          <Input />
        </Form.Item>

        <Form.Item
          name="category"
          label="Category"
          rules={[{ required: true, message: 'Category is required' }]}
        >
          <Select placeholder="Select category">
            <Option value="Residential">Residential</Option>
            <Option value="Commercial">Commercial</Option>
          </Select>
        </Form.Item>

        <Form.Item name="assignedSalesperson" label="Assigned Salesperson">
          <Input placeholder="Enter salesperson name" />
        </Form.Item>

        <Form.Item
          name="leadSource"
          label="Lead Source"
          rules={[{ required: true, message: 'Lead source is required' }]}
        >
          <Select>
            {leadSources.map((src) => (
              <Option key={src} value={src}>
                {src}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="status" label="Status">
          <Select>
            <Option value="New">New</Option>
            <Option value="Contacted">Contacted</Option>
            <Option value="Quoted">Quoted</Option>
            <Option value="Lost">Lost</Option>
          </Select>
        </Form.Item>

        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={3} placeholder="Any notes..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
