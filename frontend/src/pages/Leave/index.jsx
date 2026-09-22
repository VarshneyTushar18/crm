import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Calendar,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from "antd";
import dayjs from "dayjs";
import { getEmployees } from "../Attendance/attendanceApi";
import { approveLeave, createLeave, getLeaves, rejectLeave } from "./leaveApi";
import { leavesForDay } from "@/utils/leaveCalendarUtils";
import { leaveStatusCellStyle } from "@/utils/leaveCalendarStyles";

const { Option } = Select;
const { TextArea } = Input;

const statusColor = (s) => {
  if (s === "Approved") return "success";
  if (s === "Rejected") return "error";
  return "processing";
};

const MAX_CELL_CHIPS = 3;

function LeaveDayChip({ leave }) {
  const style = leaveStatusCellStyle(leave.status);
  return (
    <div
      title={`${leave.employeeName} — ${leave.leaveType} (${leave.status})`}
      style={{
        fontSize: 11,
        lineHeight: "18px",
        padding: "0 6px",
        borderRadius: 4,
        marginBottom: 2,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {leave.employeeName || "Employee"}
    </div>
  );
}

export default function LeavePage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("list");
  const [calendarMonth, setCalendarMonth] = useState(dayjs());
  const [selectedDay, setSelectedDay] = useState(dayjs());
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

  const handleApprove = async (id) => {
    await approveLeave(id);
    message.success("Approved");
    fetchAll();
  };

  const handleReject = async (id) => {
    await rejectLeave(id);
    message.success("Rejected");
    fetchAll();
  };

  const selectedDayLeaves = useMemo(
    () => leavesForDay(items, selectedDay),
    [items, selectedDay]
  );

  const pendingLeaves = useMemo(
    () =>
      [...items]
        .filter((i) => i.status === "Pending")
        .sort((a, b) => dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf()),
    [items]
  );

  const renderLeaveListItem = (item, { showActions } = { showActions: true }) => (
    <List.Item
      key={item._id}
      actions={
        showActions && item.status === "Pending"
          ? [
              <Button key="approve" type="link" size="small" onClick={() => handleApprove(item._id)}>
                Approve
              </Button>,
              <Button key="reject" type="link" size="small" danger onClick={() => handleReject(item._id)}>
                Reject
              </Button>,
            ]
          : undefined
      }
    >
      <List.Item.Meta
        title={
          <Space wrap>
            <span>{item.employeeName}</span>
            <Tag style={leaveStatusCellStyle(item.status)}>{item.status}</Tag>
          </Space>
        }
        description={
          <>
            <div>{item.leaveType}</div>
            <div>
              {dayjs(item.startDate).format("DD MMM YYYY")} – {dayjs(item.endDate).format("DD MMM YYYY")}
            </div>
          </>
        }
      />
    </List.Item>
  );

  const dateCellRender = (value) => {
    const dayLeaves = leavesForDay(items, value);
    if (!dayLeaves.length) return null;
    const visible = dayLeaves.slice(0, MAX_CELL_CHIPS);
    const rest = dayLeaves.length - visible.length;
    return (
      <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 72, overflow: "auto" }}>
        {visible.map((leave) => (
          <li key={leave._id}>
            <LeaveDayChip leave={leave} />
          </li>
        ))}
        {rest > 0 ? (
          <li style={{ fontSize: 11, color: "#64748b", paddingLeft: 4 }}>+{rest} more</li>
        ) : null}
      </ul>
    );
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
            <Button size="small" type="primary" onClick={() => handleApprove(row._id)}>
              Approve
            </Button>
            <Button size="small" danger onClick={() => handleReject(row._id)}>
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
        <Tabs
          activeKey={view}
          onChange={setView}
          items={[
            {
              key: "list",
              label: "List View",
              children: (
                <div className="table-responsive-wrap">
                  <Table
                    rowKey="_id"
                    loading={loading}
                    columns={columns}
                    dataSource={items}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: "max-content" }}
                    locale={{ emptyText: <Empty description="No leave requests" /> }}
                  />
                </div>
              ),
            },
            {
              key: "calendar",
              label: "Calendar View",
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={14}>
                    <Card loading={loading} styles={{ body: { padding: 8 } }} className="worker-attendance-calendar">
                      <Calendar
                        value={selectedDay}
                        onSelect={(value) => setSelectedDay(value)}
                        onPanelChange={(value) => {
                          setCalendarMonth(value);
                          setSelectedDay(value);
                        }}
                        cellRender={(current, info) => {
                          if (info.type === "date") return dateCellRender(current);
                          return info.originNode;
                        }}
                      />
                      <Space wrap style={{ marginTop: 8 }}>
                        <Tag style={leaveStatusCellStyle("Approved")}>Approved</Tag>
                        <Tag style={leaveStatusCellStyle("Pending")}>Pending</Tag>
                        <Tag style={leaveStatusCellStyle("Rejected")}>Rejected</Tag>
                      </Space>
                      <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                        {calendarMonth.format("MMMM YYYY")}
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} lg={10}>
                    <Card
                      title="Pending action"
                      extra={
                        <Tag style={leaveStatusCellStyle("Pending")}>{pendingLeaves.length}</Tag>
                      }
                      loading={loading}
                      style={{
                        marginBottom: 16,
                        borderColor: pendingLeaves.length ? "rgba(202, 138, 4, 0.4)" : undefined,
                      }}
                      styles={{
                        header: pendingLeaves.length
                          ? { background: "rgba(254, 249, 195, 0.85)" }
                          : undefined,
                      }}
                    >
                      {pendingLeaves.length ? (
                        <List
                          dataSource={pendingLeaves}
                          renderItem={(item) => renderLeaveListItem(item)}
                          style={{ maxHeight: 280, overflow: "auto" }}
                        />
                      ) : (
                        <Empty description="No pending leave requests" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Card>
                    <Card
                      title={`Leaves — ${selectedDay.format("DD MMM YYYY")}`}
                      extra={<Tag>{selectedDayLeaves.length}</Tag>}
                      loading={loading}
                    >
                      {selectedDayLeaves.length ? (
                        <List
                          dataSource={selectedDayLeaves}
                          renderItem={(item) => renderLeaveListItem(item)}
                          style={{ maxHeight: 320, overflow: "auto" }}
                        />
                      ) : (
                        <Empty description="No leave on this day" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Card>
                  </Col>
                </Row>
              ),
            },
          ]}
        />
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
