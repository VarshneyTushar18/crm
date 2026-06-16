import { Modal, Form, Input, Select } from 'antd';
import { useEffect } from 'react';

const { Option } = Select;

export default function LeadForm({ open, onCancel, onSubmit, initialValues }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        leadSource: 'Manual Entry',
        status: 'New',
        ...initialValues,
      });
    }
  }, [open, initialValues, form]);

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
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        {/* Mandatory Fields */}
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

        <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Invalid email' }]}>
          <Input placeholder="Enter email" />
        </Form.Item>

        <Form.Item
          name="siteAddress"
          label="Job Location (Suburb/Postcode)"
          rules={[{ required: true, message: 'Job location is required' }]}
        >
          <Input.TextArea rows={2} placeholder="Enter job location" />
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

        <Form.Item
          name="assignedSalesperson"
          label="Assigned Salesperson"
        >
          <Input placeholder="Enter salesperson name" />
        </Form.Item>

        <Form.Item
          name="leadSource"
          label="Lead Source"
          rules={[{ required: true, message: 'Lead source is required' }]}
        >
          <Select>
            <Option value="Website">Website</Option>
            <Option value="Phone Call">Phone Call</Option>
            <Option value="Social Media">Social Media</Option>
            <Option value="Google">Google</Option>
            <Option value="Manual Entry">Manual Entry</Option>
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
