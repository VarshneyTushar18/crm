import { Modal, Form, Input, InputNumber, DatePicker, Button } from "antd";

export default function MeasurementForm({
  open,
  onCancel,
  onSubmit,
  initialValues,
}) {
  const [form] = Form.useForm();

  return (
    <Modal
      open={open}
      title="Site Measurement"
      footer={null}
      onCancel={onCancel}
      destroyOnClose
    >
      <Form
        layout="vertical"
        form={form}
        initialValues={initialValues}
        onFinish={onSubmit}
      >
        <Form.Item
          label="Job ID"
          name="jobId"
          rules={[{ required: true }]}
        >
          <Input placeholder="Job ID" />
        </Form.Item>

        <Form.Item
          label="Site Address"
          name="siteAddress"
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Height (mm)"
          name="height"
        >
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          label="Width (mm)"
          name="width"
        >
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          label="Length (mm)"
          name="length"
        >
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          label="Material Type"
          name="materialType"
        >
          <Input placeholder="Glass / Steel / Aluminium" />
        </Form.Item>

        <Form.Item
          label="Measurement Date"
          name="measurementDate"
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          label="Water Location"
          name="waterLocation"
        >
          <Input placeholder="Describe water location" />
        </Form.Item>

        <Form.Item
          label="Power Location"
          name="powerLocation"
        >
          <Input placeholder="Describe power location" />
        </Form.Item>

        <Form.Item
          label="Lift Access"
          name="liftAccess"
        >
          <Input placeholder="Describe lift access" />
        </Form.Item>

        <Form.Item
          label="Washroom Access"
          name="washroomAccess"
        >
          <Input placeholder="Describe washroom access" />
        </Form.Item>

        <Form.Item
          label="Notes"
          name="notes"
        >
          <Input.TextArea rows={3} />
        </Form.Item>

        <Button type="primary" htmlType="submit">
          Save Measurement
        </Button>
      </Form>
    </Modal>
  );
}