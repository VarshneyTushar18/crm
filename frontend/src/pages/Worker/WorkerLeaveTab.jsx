import { useEffect, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import dayjs from "dayjs";
import { applyLeave, getMyLeaves } from "@/pages/Leave/leaveApi";

const { Option } = Select;
const { TextArea } = Input;

const statusColor = (s) => {
  if (s === "Approved") return "success";
  if (s === "Rejected") return "error";
  return "processing";
};

export default function WorkerLeaveTab() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const leaves = await getMyLeaves();
      setItems(Array.isArray(leaves) ? leaves : []);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load leave requests");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const onSubmit = async (values) => {
    try {
      await applyLeave({
        leaveType: values.leaveType,
        startDate: values.startDate.toDate(),
        endDate: values.endDate.toDate(),
        days: values.days,
        reason: values.reason || "",
      });
      message.success("Leave request submitted for admin approval");
      setOpen(false);
      form.resetFields();
      fetchAll();
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to submit leave request");
    }
  };

  const columns = [
    { title: "Type", dataIndex: "leaveType" },
    {
      title: "From",
      dataIndex: "startDate",
      render: (v) => dayjs(v).format("DD MMM YYYY"),
    },
    {
      title: "To",
      dataIndex: "endDate",
      render: (v) => dayjs(v).format("DD MMM YYYY"),
    },
    { title: "Days", dataIndex: "days" },
    {
      title: "Status",
      dataIndex: "status",
      render: (s) => <Tag color={statusColor(s)}>{s}</Tag>,
    },
    {
      title: "Reason",
      dataIndex: "reason",
      ellipsis: true,
      render: (v) => v || "—",
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => setOpen(true)}>
          Apply for leave
        </Button>
      </Space>
      <Table
        rowKey="_id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: "No leave requests yet" }}
      />

      <Modal
        title="Apply for leave"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="leaveType" label="Leave type" initialValue="Annual" rules={[{ required: true }]}>
            <Select>
              <Option value="Annual">Annual</Option>
              <Option value="Sick">Sick</Option>
              <Option value="Unpaid">Unpaid</Option>
              <Option value="Other">Other</Option>
            </Select>
          </Form.Item>
          <Form.Item name="startDate" label="Start date" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="endDate" label="End date" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="days" label="Days" initialValue={1}>
            <InputNumber min={0.5} step={0.5} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <TextArea rows={3} placeholder="Optional" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Submit request
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
