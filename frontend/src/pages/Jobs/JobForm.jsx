import { Modal, Form, Input, Select, message } from "antd";
import { useEffect, useState } from "react";
import { getCustomers } from "../Customer/customerApi";

const { Option } = Select;

export default function JobForm({ open, onCancel, onSubmit, initialValues }) {
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

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

  useEffect(() => {
    const loadCustomers = async () => {
      if (!open) return;
      try {
        setLoadingCustomers(true);
        const result = await getCustomers();
        setCustomers(Array.isArray(result) ? result : []);
      } catch (err) {
        message.error(
          err?.response?.data?.message || err?.message || "Failed to load customers"
        );
        setCustomers([]);
      } finally {
        setLoadingCustomers(false);
      }
    };

    loadCustomers();
  }, [open]);

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
          name="customerId"
          label="Customer"
          rules={[{ required: true, message: "Customer is required" }]}
        >
          <Select
            showSearch
            loading={loadingCustomers}
            placeholder="Select customer"
            optionFilterProp="label"
            options={customers.map((c) => ({
              value: c?._id,
              label: `${c?.name || "Unnamed"}${c?.companyName ? ` (${c.companyName})` : ""}`,
            }))}
          />
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
