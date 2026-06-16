import {
  Table,
  Button,
  DatePicker,
  TimePicker,
  Select,
  Tag,
  Modal,
  Form,
  Card,
  Row,
  Col,
  message,
  Typography,
  Divider,
  Empty,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  getEmployees,
  getAttendance,
  createAttendance,
  updateAttendance,
} from "./attendanceApi";

const { Option } = Select;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function Attendance() {
  const currentUserRole = "admin";
  const currentWorkerEmail = "rahul@example.com";

  const [employees, setEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [editAttendanceModalOpen, setEditAttendanceModalOpen] = useState(false);

  const [attendanceForm] = Form.useForm();
  const [editAttendanceForm] = Form.useForm();

  const [editingRecord, setEditingRecord] = useState(null);

  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [viewType, setViewType] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedWeek, setSelectedWeek] = useState(dayjs());
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [customRange, setCustomRange] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    await Promise.all([fetchEmployees(), fetchAttendance()]);
  };

  const fetchEmployees = async () => {
    try {
      const res = await getEmployees();
      setEmployees(Array.isArray(res?.result) ? res.result : []);
    } catch (error) {
      setEmployees([]);
      message.error(
        error?.response?.data?.message || "Failed to fetch employees"
      );
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await getAttendance();
      setAttendanceData(Array.isArray(res?.result) ? res.result : []);
    } catch (error) {
      setAttendanceData([]);
      message.error(
        error?.response?.data?.message || "Failed to fetch attendance"
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusFromHours = (hours) => {
    if (hours >= 8) return "Full Day";
    if (hours > 0) return "Half Day";
    return "Absent";
  };

  const getStatusColor = (status) => {
    if (status === "Full Day") return "green";
    if (status === "Half Day") return "orange";
    return "red";
  };

  const calculateHours = (checkin, checkout) => {
    const totalMinutes = checkout.diff(checkin, "minute");
    if (totalMinutes < 0) return null;
    return +(totalMinutes / 60).toFixed(2);
  };

  const isDateInSelectedFilter = (dateStr) => {
    const recordDate = dayjs(dateStr, "DD-MM-YYYY");

    if (viewType === "daily") return recordDate.isSame(selectedDate, "day");

    if (viewType === "weekly") {
      const startOfWeek = selectedWeek.startOf("week");
      const endOfWeek = selectedWeek.endOf("week");
      return (
        (recordDate.isAfter(startOfWeek, "day") ||
          recordDate.isSame(startOfWeek, "day")) &&
        (recordDate.isBefore(endOfWeek, "day") ||
          recordDate.isSame(endOfWeek, "day"))
      );
    }

    if (viewType === "monthly") {
      return recordDate.isSame(selectedMonth, "month");
    }

    if (viewType === "custom" && customRange?.length === 2) {
      const start = customRange[0].startOf("day");
      const end = customRange[1].endOf("day");
      return (
        (recordDate.isAfter(start, "day") || recordDate.isSame(start, "day")) &&
        (recordDate.isBefore(end, "day") || recordDate.isSame(end, "day"))
      );
    }

    return true;
  };

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "Active"),
    [employees]
  );

  const filteredAttendance = useMemo(() => {
    let result = [...attendanceData];

    if (currentUserRole === "worker") {
      result = result.filter((item) => item.workerEmail === currentWorkerEmail);
    }

    if (selectedEmployee !== "all" && currentUserRole === "admin") {
      result = result.filter((item) => item.workerEmail === selectedEmployee);
    }

    result = result.filter((item) => isDateInSelectedFilter(item.date));

    return result.sort(
      (a, b) =>
        dayjs(b.date, "DD-MM-YYYY").valueOf() -
        dayjs(a.date, "DD-MM-YYYY").valueOf()
    );
  }, [
    attendanceData,
    selectedEmployee,
    viewType,
    selectedDate,
    selectedWeek,
    selectedMonth,
    customRange,
    currentUserRole,
    currentWorkerEmail,
  ]);

  const summary = useMemo(() => {
    const total = filteredAttendance.length;
    const fullDay = filteredAttendance.filter((i) => i.status === "Full Day").length;
    const halfDay = filteredAttendance.filter((i) => i.status === "Half Day").length;
    const absent = filteredAttendance.filter((i) => i.status === "Absent").length;
    const totalHours = filteredAttendance.reduce(
      (sum, item) => sum + Number(item.hours || 0),
      0
    );

    return {
      total,
      fullDay,
      halfDay,
      absent,
      totalHours: totalHours.toFixed(2),
    };
  }, [filteredAttendance]);

  const handleAddAttendance = async () => {
    try {
      const values = await attendanceForm.validateFields();

      const selectedEmployeeObj = employees.find(
        (emp) => emp.email === values.workerEmail
      );

      if (!selectedEmployeeObj) {
        message.error("Selected employee not found");
        return;
      }

      if (selectedEmployeeObj.status !== "Active") {
        message.error("Inactive employee attendance cannot be added");
        return;
      }

      const hours = calculateHours(values.checkin, values.checkout);

      if (hours === null) {
        message.error("Check-out time must be after check-in time");
        return;
      }

      const payload = {
        workerName: selectedEmployeeObj.name,
        workerEmail: selectedEmployeeObj.email,
        employeeId: selectedEmployeeObj.employeeId,
        designation: selectedEmployeeObj.designation,
        department: selectedEmployeeObj.department,
        date: values.date.format("DD-MM-YYYY"),
        checkin: values.checkin.format("HH:mm"),
        checkout: values.checkout.format("HH:mm"),
        hours,
        status: getStatusFromHours(hours),
        source: "Manual",
      };

      const res = await createAttendance(payload);

      if (res?.success) {
        message.success(res?.message || "Attendance added successfully");
        attendanceForm.resetFields();
        setAttendanceModalOpen(false);
        await fetchAttendance();
      } else {
        message.error(res?.message || "Failed to add attendance");
      }
    } catch (error) {
      if (error?.errorFields) return;
      message.error(
        error?.response?.data?.message || "Failed to add attendance"
      );
    }
  };

  const openEditAttendance = (record) => {
    setEditingRecord(record);

    editAttendanceForm.setFieldsValue({
      workerEmail: record.workerEmail,
      date: record.date ? dayjs(record.date, "DD-MM-YYYY") : null,
      checkin: record.checkin ? dayjs(record.checkin, "HH:mm") : null,
      checkout: record.checkout ? dayjs(record.checkout, "HH:mm") : null,
    });

    setEditAttendanceModalOpen(true);
  };

  const handleEditAttendance = async () => {
    try {
      const values = await editAttendanceForm.validateFields();

      const selectedEmployeeObj = employees.find(
        (emp) => emp.email === values.workerEmail
      );

      if (!selectedEmployeeObj) {
        message.error("Selected employee not found");
        return;
      }

      if (selectedEmployeeObj.status !== "Active") {
        message.error("Inactive employee attendance cannot be updated");
        return;
      }

      const hours = calculateHours(values.checkin, values.checkout);

      if (hours === null) {
        message.error("Check-out time must be after check-in time");
        return;
      }

      const payload = {
        workerName: selectedEmployeeObj.name,
        workerEmail: selectedEmployeeObj.email,
        employeeId: selectedEmployeeObj.employeeId,
        designation: selectedEmployeeObj.designation,
        department: selectedEmployeeObj.department,
        date: values.date.format("DD-MM-YYYY"),
        checkin: values.checkin.format("HH:mm"),
        checkout: values.checkout.format("HH:mm"),
        hours,
        status: getStatusFromHours(hours),
        source: "Manual",
      };

      const res = await updateAttendance(editingRecord._id, payload);

      if (res?.success) {
        setEditAttendanceModalOpen(false);
        setEditingRecord(null);
        editAttendanceForm.resetFields();
        message.success(res?.message || "Attendance updated successfully");
        await fetchAttendance();
      } else {
        message.error(res?.message || "Failed to update attendance");
      }
    } catch (error) {
      if (error?.errorFields) return;
      message.error(
        error?.response?.data?.message || "Failed to update attendance"
      );
    }
  };

  const columns = [
    {
      title: "Employee",
      dataIndex: "workerName",
      width: 160,
    },
    {
      title: "Employee ID",
      dataIndex: "employeeId",
      width: 130,
    },
    {
      title: "Email",
      dataIndex: "workerEmail",
      width: 220,
    },
    {
      title: "Designation",
      dataIndex: "designation",
      width: 150,
    },
    {
      title: "Department",
      dataIndex: "department",
      width: 150,
    },
    {
      title: "Date",
      dataIndex: "date",
      width: 120,
    },
    {
      title: "Check In",
      dataIndex: "checkin",
      width: 100,
    },
    {
      title: "Check Out",
      dataIndex: "checkout",
      width: 100,
    },
    {
      title: "Hours",
      dataIndex: "hours",
      width: 90,
    },
    {
      title: "Status",
      width: 110,
      render: (_, record) => (
        <Tag color={getStatusColor(record.status)}>{record.status}</Tag>
      ),
    },
    {
      title: "Source",
      dataIndex: "source",
      width: 100,
      render: (value) => <Tag color="blue">{value}</Tag>,
    },
    ...(currentUserRole === "admin"
      ? [
          {
            title: "Action",
            width: 100,
            fixed: "right",
            render: (_, record) => (
              <Button type="link" onClick={() => openEditAttendance(record)}>
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div style={{ padding: 20 }}>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            {currentUserRole === "admin" ? "Attendance Management" : "My Attendance"}
          </Title>
          <Text type="secondary">
            {currentUserRole === "admin"
              ? "Add manual attendance, edit attendance, and track employee records by date range"
              : "View your attendance records"}
          </Text>
        </Col>

        {currentUserRole === "admin" && (
          <Col>
            <Button type="primary" onClick={() => setAttendanceModalOpen(true)}>
              + Add Attendance
            </Button>
          </Col>
        )}
      </Row>

      <Divider />

      <Card style={{ marginBottom: 20 }}>
        <Row gutter={[16, 16]}>
          {currentUserRole === "admin" && (
            <Col xs={24} sm={12} md={6}>
              <Text strong>Select Employee</Text>
              <Select
                showSearch
                optionFilterProp="children"
                style={{ width: "100%", marginTop: 6 }}
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                placeholder="Select employee"
                filterOption={(input, option) =>
                  (option?.children ?? "")
                    .toString()
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                <Option value="all">All Employees</Option>
                {employees.map((employee) => (
                  <Option key={employee.email} value={employee.email}>
                    {employee.name} ({employee.employeeId})
                  </Option>
                ))}
              </Select>
            </Col>
          )}

          <Col xs={24} sm={12} md={6}>
            <Text strong>View Type</Text>
            <Select
              style={{ width: "100%", marginTop: 6 }}
              value={viewType}
              onChange={setViewType}
            >
              <Option value="daily">Daily</Option>
              <Option value="weekly">Weekly</Option>
              <Option value="monthly">Monthly</Option>
              <Option value="custom">Custom Range</Option>
            </Select>
          </Col>

          {viewType === "daily" && (
            <Col xs={24} sm={12} md={6}>
              <Text strong>Select Date</Text>
              <DatePicker
                style={{ width: "100%", marginTop: 6 }}
                value={selectedDate}
                onChange={(value) => setSelectedDate(value)}
                format="DD-MM-YYYY"
              />
            </Col>
          )}

          {viewType === "weekly" && (
            <Col xs={24} sm={12} md={6}>
              <Text strong>Select Week</Text>
              <DatePicker
                style={{ width: "100%", marginTop: 6 }}
                value={selectedWeek}
                onChange={(value) => setSelectedWeek(value)}
                format="DD-MM-YYYY"
              />
            </Col>
          )}

          {viewType === "monthly" && (
            <Col xs={24} sm={12} md={6}>
              <Text strong>Select Month</Text>
              <DatePicker
                picker="month"
                style={{ width: "100%", marginTop: 6 }}
                value={selectedMonth}
                onChange={(value) => setSelectedMonth(value)}
                format="MM-YYYY"
              />
            </Col>
          )}

          {viewType === "custom" && (
            <Col xs={24} sm={24} md={10}>
              <Text strong>Custom Range</Text>
              <RangePicker
                style={{ width: "100%", marginTop: 6 }}
                value={customRange}
                onChange={(value) => setCustomRange(value || [])}
                format="DD-MM-YYYY"
              />
            </Col>
          )}
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Total Records</Text>
            <Title level={4} style={{ margin: "8px 0 0" }}>
              {summary.total}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Full Days</Text>
            <Title level={4} style={{ margin: "8px 0 0", color: "#389e0d" }}>
              {summary.fullDay}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Half Days</Text>
            <Title level={4} style={{ margin: "8px 0 0", color: "#d48806" }}>
              {summary.halfDay}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Total Hours</Text>
            <Title level={4} style={{ margin: "8px 0 0" }}>
              {summary.totalHours}
            </Title>
          </Card>
        </Col>
      </Row>

      {filteredAttendance.length ? (
        <Table
          rowKey="_id"
          loading={loading}
          columns={columns}
          dataSource={filteredAttendance}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1500 }}
        />
      ) : (
        <Card>
          <Empty description="No attendance records found" />
        </Card>
      )}

      <Modal
        title="Add Manual Attendance"
        open={attendanceModalOpen}
        onOk={handleAddAttendance}
        onCancel={() => {
          setAttendanceModalOpen(false);
          attendanceForm.resetFields();
        }}
        okText="Save"
      >
        <Form form={attendanceForm} layout="vertical">
          <Form.Item
            label="Employee"
            name="workerEmail"
            rules={[{ required: true, message: "Please select employee" }]}
          >
            <Select
              showSearch
              optionFilterProp="children"
              placeholder="Select employee"
              filterOption={(input, option) =>
                (option?.children ?? "")
                  .toString()
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {activeEmployees.map((employee) => (
                <Option key={employee.email} value={employee.email}>
                  {employee.name} - {employee.employeeId} - {employee.designation}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Date"
            name="date"
            rules={[{ required: true, message: "Please select date" }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
          </Form.Item>

          <Form.Item
            label="Check In"
            name="checkin"
            rules={[{ required: true, message: "Please select check-in time" }]}
          >
            <TimePicker style={{ width: "100%" }} format="HH:mm" />
          </Form.Item>

          <Form.Item
            label="Check Out"
            name="checkout"
            rules={[{ required: true, message: "Please select check-out time" }]}
          >
            <TimePicker style={{ width: "100%" }} format="HH:mm" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Edit Attendance"
        open={editAttendanceModalOpen}
        onOk={handleEditAttendance}
        onCancel={() => {
          setEditAttendanceModalOpen(false);
          setEditingRecord(null);
          editAttendanceForm.resetFields();
        }}
        okText="Update"
      >
        <Form form={editAttendanceForm} layout="vertical">
          <Form.Item
            label="Employee"
            name="workerEmail"
            rules={[{ required: true, message: "Please select employee" }]}
          >
            <Select
              showSearch
              optionFilterProp="children"
              placeholder="Select employee"
              filterOption={(input, option) =>
                (option?.children ?? "")
                  .toString()
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {activeEmployees.map((employee) => (
                <Option key={employee.email} value={employee.email}>
                  {employee.name} - {employee.employeeId} - {employee.designation}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Date"
            name="date"
            rules={[{ required: true, message: "Please select date" }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
          </Form.Item>

          <Form.Item
            label="Check In"
            name="checkin"
            rules={[{ required: true, message: "Please select check-in time" }]}
          >
            <TimePicker style={{ width: "100%" }} format="HH:mm" />
          </Form.Item>

          <Form.Item
            label="Check Out"
            name="checkout"
            rules={[{ required: true, message: "Please select check-out time" }]}
          >
            <TimePicker style={{ width: "100%" }} format="HH:mm" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}