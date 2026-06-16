import { Modal, Form, Input, Select } from "antd";
import { useEffect } from "react";

const { Option } = Select;

export default function JobForm({ open, onCancel, onSubmit, initialValues }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        stage: "Contract Stage",
        status: "Backlog",
        ...initialValues,
      });
    }
  }, [open, initialValues, form]);

  return (
    <Modal
      title={initialValues?._id ? "Edit Job" : "Create Job"}
      open={open}
      onCancel={() => {
        onCancel();
        form.resetFields();
      }}
      onOk={() => form.submit()}
      okText="Save"
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item
          name="jobId"
          label="Job ID"
          rules={[{ required: true, message: "Job ID is required" }]}
        >
          <Input placeholder="e.g. JOB-1001" />
        </Form.Item>

        <Form.Item
          name="customer"
          label="Customer"
          rules={[{ required: true, message: "Customer is required" }]}
        >
          <Input placeholder="Customer name" />
        </Form.Item>

        <Form.Item
          name="site"
          label="Site"
          rules={[{ required: true, message: "Site is required" }]}
        >
          <Input placeholder="Site address / location" />
        </Form.Item>

        <Form.Item name="stage" label="Stage">
          <Select>
            <Option value="Contract Stage">Contract Stage</Option>
            <Option value="Planning">Planning</Option>
            <Option value="In Progress">In Progress</Option>
            <Option value="Completed">Completed</Option>
          </Select>
        </Form.Item>

        <Form.Item name="status" label="Status">
          <Select>
            <Option value="Backlog">Backlog</Option>
            <Option value="Active">Active</Option>
            <Option value="On Hold">On Hold</Option>
            <Option value="Closed">Closed</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
