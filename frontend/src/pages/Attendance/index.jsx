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
import { parseAttendanceDate } from "@/utils/parseAttendanceDate";
import { getStatusFromHours } from "@/utils/attendanceStatusRules";
import {
  getEmployees,
  getAttendance,
  createAttendance,
  updateAttendance,
  reconcileWorkerAttendance,
} from "./attendanceApi";
import EmployeeTimesheetPanel from "./EmployeeTimesheetPanel";

const { Option } = Select;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function Attendance() {
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const currentUserRole =
    String(storedUser?.role || "admin").toLowerCase() === "worker"
      ? "worker"
      : "admin";
  const currentWorkerEmail = String(storedUser?.email || "").trim();

  const [employees, setEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [editAttendanceModalOpen, setEditAttendanceModalOpen] = useState(false);

  const [attendanceForm] = Form.useForm();
  const [editAttendanceForm] = Form.useForm();

  const [editingRecord, setEditingRecord] = useState(null);

  const [draftEmployee, setDraftEmployee] = useState("all");
  const [draftViewType, setDraftViewType] = useState("daily");
  const [draftDate, setDraftDate] = useState(() => dayjs());
  const [draftWeek, setDraftWeek] = useState(() => dayjs());
  const [draftMonth, setDraftMonth] = useState(() => dayjs());
  const [draftCustomRange, setDraftCustomRange] = useState([]);

  const [appliedEmployee, setAppliedEmployee] = useState("all");
  const [appliedViewType, setAppliedViewType] = useState("daily");
  const [appliedDate, setAppliedDate] = useState(() => dayjs());
  const [appliedWeek, setAppliedWeek] = useState(() => dayjs());
  const [appliedMonth, setAppliedMonth] = useState(() => dayjs());
  const [appliedCustomRange, setAppliedCustomRange] = useState([]);
  const [filtersApplied, setFiltersApplied] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    if (currentUserRole === "admin") {
      await fetchEmployees();
    }
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
      let res;
      if (currentUserRole === "admin") {
        try {
          res = await reconcileWorkerAttendance();
        } catch {
          res = await getAttendance();
        }
      } else {
        res = await getAttendance();
      }
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

  const isDateInAppliedFilter = (dateStr) => {
    const recordDate = parseAttendanceDate(dateStr);
    if (!recordDate) return false;

    if (appliedViewType === "daily") {
      const anchor =
        appliedDate && dayjs(appliedDate).isValid() ? dayjs(appliedDate) : dayjs();
      return recordDate.isSame(anchor, "day");
    }

    if (appliedViewType === "weekly") {
      const anchor =
        appliedWeek && dayjs(appliedWeek).isValid() ? dayjs(appliedWeek) : dayjs();
      const startOfWeek = anchor.startOf("week");
      const endOfWeek = anchor.endOf("week");
      return (
        !recordDate.isBefore(startOfWeek, "day") && !recordDate.isAfter(endOfWeek, "day")
      );
    }

    if (appliedViewType === "monthly") {
      const anchor =
        appliedMonth && dayjs(appliedMonth).isValid() ? dayjs(appliedMonth) : dayjs();
      return recordDate.isSame(anchor, "month");
    }

    if (appliedViewType === "custom") {
      if (!appliedCustomRange?.[0] || !appliedCustomRange?.[1]) return false;
      const start = dayjs(appliedCustomRange[0]).startOf("day");
      const end = dayjs(appliedCustomRange[1]).endOf("day");
      if (!start.isValid() || !end.isValid()) return false;
      return !recordDate.isBefore(start, "day") && !recordDate.isAfter(end, "day");
    }

    return true;
  };

  const handleApplyFilters = async () => {
    setAppliedEmployee(draftEmployee);
    setAppliedViewType(draftViewType);
    setAppliedDate(draftDate);
    setAppliedWeek(draftWeek);
    setAppliedMonth(draftMonth);
    setAppliedCustomRange(draftCustomRange);
    setFiltersApplied(true);
    await fetchAttendance();
  };

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "Active"),
    [employees]
  );

  const filteredAttendance = useMemo(() => {
    if (!filtersApplied) {
      return [];
    }

    let result = [...attendanceData];

    if (currentUserRole === "worker") {
      result = result.filter((item) => item.workerEmail === currentWorkerEmail);
    }

    if (appliedEmployee !== "all" && currentUserRole === "admin") {
      const email = String(appliedEmployee).toLowerCase();
      result = result.filter(
        (item) => String(item.workerEmail || "").toLowerCase() === email
      );
    }

    result = result.filter((item) => isDateInAppliedFilter(item.date));

    return result.sort(
      (a, b) =>
        (parseAttendanceDate(b.date)?.valueOf() ?? 0) -
        (parseAttendanceDate(a.date)?.valueOf() ?? 0)
    );
  }, [
    attendanceData,
    filtersApplied,
    appliedEmployee,
    appliedViewType,
    appliedDate,
    appliedWeek,
    appliedMonth,
    appliedCustomRange,
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
        if (filtersApplied) {
          await fetchAttendance();
        }
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
      date: record.date ? parseAttendanceDate(record.date) : null,
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
        if (filtersApplied) {
          await fetchAttendance();
        }
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
              ? "Employee punch timesheet (photos + check-in/out) and manual attendance records"
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

      {currentUserRole === "admin" ? <EmployeeTimesheetPanel /> : null}

      <Card style={{ marginBottom: 20, marginTop: currentUserRole === "admin" ? 16 : 0 }}>
        <Row gutter={[16, 16]}>
          {currentUserRole === "admin" && (
            <Col xs={24} sm={12} md={6}>
              <Text strong>Select Employee</Text>
              <Select
                showSearch
                optionFilterProp="children"
                style={{ width: "100%", marginTop: 6 }}
                value={draftEmployee}
                onChange={setDraftEmployee}
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
              value={draftViewType}
              onChange={setDraftViewType}
            >
              <Option value="daily">Daily</Option>
              <Option value="weekly">Weekly</Option>
              <Option value="monthly">Monthly</Option>
              <Option value="custom">Custom Range</Option>
            </Select>
          </Col>

          {draftViewType === "daily" && (
            <Col xs={24} sm={12} md={6}>
              <Text strong>Select Date</Text>
              <DatePicker
                style={{ width: "100%", marginTop: 6 }}
                value={draftDate}
                onChange={(value) => setDraftDate(value || dayjs())}
                format="DD-MM-YYYY"
                allowClear={false}
              />
            </Col>
          )}

          {draftViewType === "weekly" && (
            <Col xs={24} sm={12} md={6}>
              <Text strong>Select Week</Text>
              <DatePicker
                style={{ width: "100%", marginTop: 6 }}
                value={draftWeek}
                onChange={(value) => setDraftWeek(value || dayjs())}
                format="DD-MM-YYYY"
                allowClear={false}
              />
            </Col>
          )}

          {draftViewType === "monthly" && (
            <Col xs={24} sm={12} md={6}>
              <Text strong>Select Month</Text>
              <DatePicker
                picker="month"
                style={{ width: "100%", marginTop: 6 }}
                value={draftMonth}
                onChange={(value) =>
                  setDraftMonth(value ? value.startOf("month") : dayjs().startOf("month"))
                }
                format="MM-YYYY"
                allowClear={false}
              />
            </Col>
          )}

          {draftViewType === "custom" && (
            <Col xs={24} sm={24} md={10}>
              <Text strong>Custom Range</Text>
              <RangePicker
                style={{ width: "100%", marginTop: 6 }}
                value={draftCustomRange}
                onChange={(value) => setDraftCustomRange(value || [])}
                format="DD-MM-YYYY"
              />
            </Col>
          )}

          <Col xs={24} sm={12} md={4}>
            <Text strong style={{ display: "block", visibility: "hidden" }}>
              Apply
            </Text>
            <Button
              type="primary"
              block
              loading={loading}
              onClick={handleApplyFilters}
              style={{ marginTop: 6 }}
            >
              Apply
            </Button>
          </Col>
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
          <Empty
            description={
              filtersApplied
                ? "No attendance records found"
                : "Select filters and click Apply to view attendance"
            }
          />
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