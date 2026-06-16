import React, { useEffect } from "react";
import {
  Form,
  Input,
  Row,
  Col,
  Select,
  InputNumber,
  Divider,
  Button,
  Space,
  DatePicker,
} from "antd";
import dayjs from "dayjs";

const { TextArea } = Input;

const STATUS = [
  "Draft",
  "Sent",
  "Rejected",
];

export default function QuoteForm({
  form,
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
  isLocked = false,
}) {
  useEffect(() => {
    if (!initialValues) return;

    const values = { ...initialValues };

    // DatePicker needs dayjs object
    if (values.validUntil && typeof values.validUntil === "string") {
      values.validUntil = dayjs(values.validUntil);
    }

    form.setFieldsValue(values);
  }, [initialValues, form]);

  const handleFinish = (values) => {
    const payload = {
      ...values,
      validUntil: values.validUntil
        ? values.validUntil.format("YYYY-MM-DD")
        : null,
    };

    onSubmit(payload);
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish}>
      {/* Hidden leadId for backend mapping */}
      <Form.Item name="leadId" hidden>
        <Input />
      </Form.Item>

      <Divider orientation="left">Customer (from Lead)</Divider>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="Client Name"
            name="customerName"
            rules={[{ required: true, message: "Client name is required" }]}
          >
            <Input disabled />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item label="Contact Person" name="contactPerson">
            <Input disabled />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            label="Phone"
            name="phone"
            rules={[{ required: true, message: "Phone is required" }]}
          >
            <Input disabled />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item label="Email" name="email">
            <Input disabled />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">Project</Divider>
      <Row gutter={16}>
        <Col xs={24}>
          <Form.Item
            label="Site Address"
            name="siteAddress"
            rules={[{ required: true, message: "Site address is required" }]}
          >
            <TextArea rows={2} disabled />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item label="Lead Source" name="leadSource">
            <Input disabled />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">Quote Configuration (Order ID Settings)</Divider>
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Form.Item label="Value Level" name="valueLevel" rules={[{ required: true }]}>
            <Select disabled={isLocked}>
              <Select.Option value="High">High</Select.Option>
              <Select.Option value="Medium">Medium</Select.Option>
              <Select.Option value="Low">Low</Select.Option>
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={6}>
          <Form.Item label="Priority" name="priority" rules={[{ required: true }]}>
            <Select disabled={isLocked}>
              <Select.Option value={1}>1 - Urgent</Select.Option>
              <Select.Option value={2}>2 - Normal</Select.Option>
              <Select.Option value={3}>3 - Low</Select.Option>
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={6}>
          <Form.Item label="Category" name="categoryCode" rules={[{ required: true }]}>
            <Select disabled={isLocked}>
              <Select.Option value="Commercial">Commercial</Select.Option>
              <Select.Option value="Residential">Residential</Select.Option>
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={6}>
          <Form.Item label="Material" name="materialCode" rules={[{ required: true }]}>
            <Select disabled={isLocked}>
              <Select.Option value="Aluminium">Aluminium</Select.Option>
              <Select.Option value="Glass">Glass</Select.Option>
              <Select.Option value="Stainless Steel">Stainless Steel</Select.Option>
              <Select.Option value="Wood">Wood</Select.Option>
              <Select.Option value="Other">Other</Select.Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">Scope (Mandatory)</Divider>
      <Form.Item
        label="Scope Definition"
        name="scope"
        rules={[{ required: true, message: "Scope definition is required" }]}
      >
        <TextArea rows={3} placeholder="Detailed work breakdown..." disabled={isLocked} />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="Inclusions"
            name="inclusions"
            rules={[{ required: true, message: "Inclusions are required" }]}
          >
            <TextArea rows={4} placeholder="What is included?" disabled={isLocked} />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            label="Exclusions"
            name="exclusions"
            rules={[{ required: true, message: "Exclusions are required" }]}
          >
            <TextArea rows={4} placeholder="What is excluded?" disabled={isLocked} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Assumptions" name="assumptions">
        <TextArea rows={3} placeholder="Assumptions / constraints..." disabled={isLocked} />
      </Form.Item>

      <Divider orientation="left">Quote Details</Divider>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            label="Quote Amount (Estimated Value)"
            name="totalAmount"
            rules={[{ required: true, message: "Quote amount is required" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0}
              placeholder="Enter quote value"
              disabled={isLocked}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item
            label="Quote Valid Until"
            name="validUntil"
            rules={[{ required: true, message: "Validity date is required" }]}
          >
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" disabled={isLocked} />
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: "Status is required" }]}
          >
            <Select
              placeholder="Select status"
              options={STATUS.map((s) => ({ value: s, label: s }))}
              disabled={isLocked}
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider />
      {!isLocked && (
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save Quote (v{(initialValues?.version || 0) + 1})
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Space>
      )}
    </Form>
  );
}