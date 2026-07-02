import { useEffect, useState } from "react";
import {
  Button,
  Card,
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
import { getEmployees } from "../Attendance/attendanceApi";
import { approveLeave, createLeave, deleteLeave, getLeaves, rejectLeave } from "./leaveApi";

const { Option } = Select;
const { TextArea } = Input;

const statusColor = (s) => {
  if (s === "Approved") return "success";
  if (s === "Rejected") return "error";
  return "processing";
};

export default function LeavePage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [leaves, emps] = await Promise.all([getLeaves(), getEmployees()]);
      setItems(Array.isArray(leaves) ? leaves : leaves?.result || []);
      setEmployees(Array.isArray(emps) ? emps : emps?.result || []);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const onSubmit = async (values) => {
    try {
      await createLeave({
        ...values,
        startDate: values.startDate.toDate(),
        endDate: values.endDate.toDate(),
      });
      message.success("Leave request created");
      setOpen(false);
      form.resetFields();
      fetchAll();
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to create leave");
    }
  };

  const columns = [
    { title: "Employee", dataIndex: "employeeName" },
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
      title: "Actions",
      render: (_, row) =>
        row.status === "Pending" ? (
          <Space>
            <Button
              size="small"
              type="primary"
              onClick={async () => {
                await approveLeave(row._id);
                message.success("Approved");
                fetchAll();
              }}
            >
              Approve
            </Button>
            <Button
              size="small"
              danger
              onClick={async () => {
                await rejectLeave(row._id);
                message.success("Rejected");
                fetchAll();
              }}
            >
              Reject
            </Button>
          </Space>
        ) : (
          "-"
        ),
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Card
        title="Leave Management"
        extra={
          <Button type="primary" onClick={() => setOpen(true)}>
            + New Leave Request
          </Button>
        }
      >
        <Table rowKey="_id" loading={loading} columns={columns} dataSource={items} />
      </Card>

      <Modal
        title="New Leave Request"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label">
              {employees.map((e) => (
                <Option key={e._id} value={e._id} label={e.name}>
                  {e.name} ({e.employeeId || e.email})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="leaveType" label="Leave Type" initialValue="Annual">
            <Select>
              <Option value="Annual">Annual</Option>
              <Option value="Sick">Sick</Option>
              <Option value="Unpaid">Unpaid</Option>
              <Option value="Other">Other</Option>
            </Select>
          </Form.Item>
          <Form.Item name="startDate" label="Start Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="endDate" label="End Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="days" label="Days" initialValue={1}>
            <InputNumber min={0.5} step={0.5} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Submit
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
