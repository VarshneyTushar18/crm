import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  TimePicker,
  Typography,
  message,
} from "antd";
import {
  CheckCircleFilled,
  CloseCircleOutlined,
  DownloadOutlined,
  InfoCircleFilled,
  SendOutlined,
  StarFilled,
  StarOutlined,
  UploadOutlined,
  UserOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { getEmployees } from "@/pages/Employee/employeeApi";
import {
  getAttendance,
  createAttendance,
  reconcileWorkerAttendance,
} from "@/pages/Attendance/attendanceApi";
import { getLeaves } from "@/pages/Leave/leaveApi";
import AttendanceStatusCell from "./AttendanceStatusCell";
import {
  buildMatrixForMonth,
  CELL_STATUS,
  computeTodayAttendanceDetail,
  countPresentTodayByDesignation,
  matrixToCsv,
  LATE_AFTER_TIME,
} from "./attendanceMatrixUtils";
import { getStatusFromHours } from "@/utils/attendanceStatusRules";

const { Title, Text } = Typography;

/** Above this count, matrix uses pagination + department/search filters. */
const HR_MATRIX_EMPLOYEE_LIMIT = 30;
const MATRIX_PAGE_SIZE_DEFAULT = 25;

const TODAY_HIGHLIGHT_HEADER_BG = "#bae0ff";
const TODAY_HIGHLIGHT_CELL_BG = "#e6f4ff";

const TODAY_STATUS_FILTERS = {
  present: [CELL_STATUS.PRESENT],
  halfDay: [CELL_STATUS.HALF],
  late: [CELL_STATUS.LATE],
  absent: [CELL_STATUS.ABSENT],
  leave: [CELL_STATUS.LEAVE],
};

const TODAY_FILTER_LABELS = {
  present: "Present today",
  halfDay: "Half day today",
  late: "Late today",
  absent: "Absent today",
  leave: "On leave today",
};

const LEGEND = [
  { icon: <StarFilled style={{ color: "#faad14" }} />, label: "Holiday" },
  { icon: <CheckCircleFilled style={{ color: "#339393" }} />, label: "Present" },
  { icon: <StarOutlined style={{ color: "#339393" }} />, label: "Half Day" },
  { icon: <InfoCircleFilled style={{ color: "#339393" }} />, label: `Late (after ${LATE_AFTER_TIME})` },
  { icon: <CloseCircleOutlined style={{ color: "#bfbfbf" }} />, label: "Absent" },
  { icon: <SendOutlined style={{ color: "#ff4d4f" }} />, label: "On Leave" },
];

function calculateHours(checkin, checkout) {
  const totalMinutes = checkout.diff(checkin, "minute");
  if (totalMinutes < 0) return null;
  return +(totalMinutes / 60).toFixed(2);
}

function filterCardStyle(active) {
  return active
    ? {
        cursor: "pointer",
        borderColor: "#339393",
        boxShadow: "0 0 0 2px rgba(22,119,255,0.2)",
      }
    : { cursor: "pointer" };
}

export default function HrDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().startOf("month"));
  const [employees, setEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [matrixPage, setMatrixPage] = useState(1);
  const [matrixPageSize, setMatrixPageSize] = useState(MATRIX_PAGE_SIZE_DEFAULT);

  const [markModalOpen, setMarkModalOpen] = useState(false);
  const [markForm] = Form.useForm();
  const [todayStatusFilter, setTodayStatusFilter] = useState(null);
  const matrixSectionRef = useRef(null);

  const scrollToMatrix = useCallback(() => {
    matrixSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const applyTodayFilter = useCallback(
    (filterKey) => {
      setTodayStatusFilter((prev) => (prev === filterKey ? null : filterKey));
      setMatrixPage(1);
      scrollToMatrix();
    },
    [scrollToMatrix]
  );

  const clearTodayFilter = useCallback(() => {
    setTodayStatusFilter(null);
    setMatrixPage(1);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, attRes, leaveList] = await Promise.all([
        getEmployees(),
        getAttendance(),
        getLeaves(),
      ]);
      setEmployees(Array.isArray(empRes?.result) ? empRes.result : []);
      setAttendanceData(Array.isArray(attRes?.result) ? attRes.result : []);
      setLeaves(Array.isArray(leaveList) ? leaveList : []);
    } catch (error) {
      message.error(error?.response?.data?.message || "Failed to load HR dashboard data");
      setEmployees([]);
      setAttendanceData([]);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSyncPunches = async () => {
    try {
      setSyncing(true);
      await reconcileWorkerAttendance();
      await loadData();
      message.success("Worker punches synced to attendance");
    } catch (error) {
      message.error(error?.response?.data?.message || "Failed to sync punches");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === "Active"),
    [employees]
  );

  const todayDetail = useMemo(
    () =>
      computeTodayAttendanceDetail({
        employees,
        attendanceRows: attendanceData,
        leaves,
      }),
    [employees, attendanceData, leaves]
  );

  const { employeeTodayStatus, ...todayBreakdown } = todayDetail;
  const fullDayPresent = Math.max(
    0,
    todayBreakdown.present - todayBreakdown.halfDay - todayBreakdown.lateArrivals
  );

  const todayDayOfMonth = useMemo(() => {
    const now = dayjs();
    if (!selectedMonth.isSame(now, "month")) return null;
    return now.date();
  }, [selectedMonth]);

  const designationBreakdown = useMemo(
    () =>
      countPresentTodayByDesignation({
        employees,
        attendanceRows: attendanceData,
        leaves,
      }),
    [employees, attendanceData, leaves]
  );

  const scaledMatrixMode = activeEmployees.length > HR_MATRIX_EMPLOYEE_LIMIT;

  const departmentOptions = useMemo(() => {
    const set = new Set();
    for (const emp of activeEmployees) {
      const dept = String(emp.department || "").trim();
      if (dept) set.add(dept);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [activeEmployees]);

  const employeesForMatrix = useMemo(() => {
    if (!scaledMatrixMode) return activeEmployees;

    const q = searchText.trim().toLowerCase();
    return activeEmployees.filter((emp) => {
      if (departmentFilter !== "all") {
        if (String(emp.department || "").trim() !== departmentFilter) return false;
      }
      if (!q) return true;
      const name = String(emp.name || "").toLowerCase();
      const id = String(emp.employeeId || "").toLowerCase();
      const email = String(emp.email || "").toLowerCase();
      return name.includes(q) || id.includes(q) || email.includes(q);
    });
  }, [activeEmployees, scaledMatrixMode, departmentFilter, searchText]);

  const { daysInMonth, rows: matrixRows } = useMemo(
    () =>
      buildMatrixForMonth({
        employees: employeesForMatrix,
        attendanceRows: attendanceData,
        leaves,
        monthRef: selectedMonth,
      }),
    [employeesForMatrix, attendanceData, leaves, selectedMonth]
  );

  const filteredMatrixRows = useMemo(() => {
    if (!todayStatusFilter) return matrixRows;
    const allowed = TODAY_STATUS_FILTERS[todayStatusFilter];
    return matrixRows.filter((row) => {
      const status = employeeTodayStatus[row.key];
      return status && allowed.includes(status);
    });
  }, [matrixRows, todayStatusFilter, employeeTodayStatus]);

  const exportMatrixRows = useMemo(
    () =>
      buildMatrixForMonth({
        employees: activeEmployees,
        attendanceRows: attendanceData,
        leaves,
        monthRef: selectedMonth,
      }).rows,
    [activeEmployees, attendanceData, leaves, selectedMonth]
  );

  const dayColumns = useMemo(() => {
    const cols = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = selectedMonth.date(d);
      const weekday = date.format("ddd");
      const isTodayColumn = todayDayOfMonth !== null && d === todayDayOfMonth;
      cols.push({
        title: (
          <div style={{ textAlign: "center", lineHeight: 1.2 }}>
            <div>{d}</div>
            <div
              style={{
                fontSize: 10,
                color: isTodayColumn ? "#339393" : "#8c8c8c",
                fontWeight: isTodayColumn ? 600 : 400,
              }}
            >
              {weekday}
              {isTodayColumn ? " · Today" : ""}
            </div>
          </div>
        ),
        key: `day-${d}`,
        width: isTodayColumn ? 52 : 44,
        align: "center",
        onHeaderCell: () =>
          isTodayColumn
            ? { style: { background: TODAY_HIGHLIGHT_HEADER_BG, fontWeight: 600 } }
            : {},
        onCell: () =>
          isTodayColumn ? { style: { background: TODAY_HIGHLIGHT_CELL_BG } } : {},
        render: (_, record) => (
          <AttendanceStatusCell detail={record.dayDetails[d - 1]} />
        ),
      });
    }
    return cols;
  }, [daysInMonth, selectedMonth, todayDayOfMonth]);

  const columns = useMemo(
    () => [
      {
        title: "Employee",
        key: "employee",
        fixed: "left",
        width: 240,
        render: (_, record) => {
          const emp = record.employee;
          const initials = (emp.name || "?")
            .split(" ")
            .map((p) => p[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar size={36} style={{ backgroundColor: "#339393", flexShrink: 0 }}>
                {initials || <UserOutlined />}
              </Avatar>
              <div style={{ minWidth: 0 }}>
                <Text strong ellipsis style={{ display: "block", maxWidth: 180 }}>
                  {emp.name}
                </Text>
                <Text type="secondary" ellipsis style={{ fontSize: 12, maxWidth: 180 }}>
                  {emp.designation}
                </Text>
              </div>
            </div>
          );
        },
      },
      ...dayColumns,
      {
        title: "Total",
        key: "total",
        fixed: "right",
        width: 72,
        align: "center",
        render: (_, record) => <Text strong>{record.totalLabel}</Text>,
      },
    ],
    [dayColumns]
  );

  const handleExport = () => {
    const csv = matrixToCsv(exportMatrixRows, selectedMonth);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${selectedMonth.format("YYYY-MM")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.success("Attendance sheet exported");
  };

  const handleMarkAttendance = async () => {
    try {
      const values = await markForm.validateFields();
      const selectedEmployeeObj = employees.find((emp) => emp.email === values.workerEmail);
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
        message.success(res?.message || "Attendance marked successfully");
        markForm.resetFields();
        setMarkModalOpen(false);
        await loadData();
      } else {
        message.error(res?.message || "Failed to mark attendance");
      }
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || "Failed to mark attendance");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Employee Attendance Dashboard
          </Title>
          <Text type="secondary">Monthly attendance overview for all active employees</Text>
        </Col>
        <Col>
          <Space wrap>
            <Button icon={<SyncOutlined />} loading={syncing} onClick={handleSyncPunches}>
              Sync punches
            </Button>
            <Button type="primary" onClick={() => setMarkModalOpen(true)}>
              + Mark Attendance
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => message.info("Import coming soon")}>
              Import
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Export
            </Button>
          </Space>
        </Col>
      </Row>

      <Divider style={{ margin: "16px 0" }} />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 12]} wrap>
          <Col>
            <Space wrap size="large">
              <Text type="secondary">Note:</Text>
              {LEGEND.map((item) => (
                <Space key={item.label} size={6}>
                  {item.icon}
                  <Text style={{ fontSize: 13 }}>{item.label}</Text>
                </Space>
              ))}
            </Space>
          </Col>
          <Col>
            <Space>
              <Text strong>Month</Text>
              <DatePicker
                picker="month"
                value={selectedMonth}
                onChange={(value) => value && setSelectedMonth(value.startOf("month"))}
                format="MMMM YYYY"
                allowClear={false}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {scaledMatrixMode ? (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 12]} align="middle">
            <Col xs={24} md={8}>
              <Text strong>Department</Text>
              <Select
                style={{ width: "100%", marginTop: 6 }}
                value={departmentFilter}
                onChange={(value) => {
                  setDepartmentFilter(value);
                  setMatrixPage(1);
                }}
                options={[
                  { value: "all", label: "All departments" },
                  ...departmentOptions.map((d) => ({ value: d, label: d })),
                ]}
              />
            </Col>
            <Col xs={24} md={8}>
              <Text strong>Search</Text>
              <Input
                allowClear
                placeholder="Name, employee ID, or email"
                style={{ marginTop: 6 }}
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setMatrixPage(1);
                }}
              />
            </Col>
            <Col xs={24} md={8}>
              <Text type="secondary" style={{ display: "block", marginTop: 6 }}>
                {activeEmployees.length} active employees
                {employeesForMatrix.length !== activeEmployees.length
                  ? ` — ${employeesForMatrix.length} match filters`
                  : ""}
                . Paginated ({matrixPageSize} per page).
              </Text>
            </Col>
          </Row>
        </Card>
      ) : null}

      <div ref={matrixSectionRef}>
        {todayStatusFilter ? (
          <Space style={{ marginBottom: 12 }} wrap>
            <Tag closable onClose={clearTodayFilter} color="blue">
              {TODAY_FILTER_LABELS[todayStatusFilter]} ({filteredMatrixRows.length})
            </Tag>
            <Button type="link" size="small" onClick={clearTodayFilter} style={{ padding: 0 }}>
              Show all employees
            </Button>
          </Space>
        ) : null}
      <Table
        rowKey="key"
        loading={loading}
        columns={columns}
        dataSource={filteredMatrixRows}
        pagination={
          scaledMatrixMode
            ? {
                current: matrixPage,
                pageSize: matrixPageSize,
                showSizeChanger: true,
                pageSizeOptions: [25, 50],
                onChange: (page, size) => {
                  setMatrixPage(page);
                  setMatrixPageSize(size);
                },
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} employees`,
              }
            : false
        }
        scroll={{ x: 240 + daysInMonth * 44 + 72, y: "calc(100vh - 320px)" }}
        size="small"
        bordered
      />
      </div>

      <Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>
        Today&apos;s attendance
      </Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card
            size="small"
            loading={loading}
            hoverable
            onClick={() => {
              clearTodayFilter();
              scrollToMatrix();
            }}
            style={{ cursor: "pointer" }}
          >
            <Statistic title="Total Staff" value={todayBreakdown.total} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card
            size="small"
            loading={loading}
            hoverable
            onClick={() => applyTodayFilter("present")}
            style={filterCardStyle(todayStatusFilter === "present")}
          >
            <Statistic title="Present" value={fullDayPresent} valueStyle={{ color: "#339393" }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card
            size="small"
            loading={loading}
            hoverable
            onClick={() => applyTodayFilter("halfDay")}
            style={filterCardStyle(todayStatusFilter === "halfDay")}
          >
            <Statistic title="Half Day" value={todayBreakdown.halfDay} valueStyle={{ color: "#339393" }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card
            size="small"
            loading={loading}
            hoverable
            onClick={() => applyTodayFilter("late")}
            style={filterCardStyle(todayStatusFilter === "late")}
          >
            <Statistic
              title={`Late (after ${LATE_AFTER_TIME})`}
              value={todayBreakdown.lateArrivals}
              valueStyle={{ color: "#339393" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card
            size="small"
            loading={loading}
            hoverable
            onClick={() => applyTodayFilter("absent")}
            style={filterCardStyle(todayStatusFilter === "absent")}
          >
            <Statistic title="Absent" value={todayBreakdown.absent} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card
            size="small"
            loading={loading}
            hoverable
            onClick={() => applyTodayFilter("leave")}
            style={
              todayStatusFilter === "leave"
                ? {
                    cursor: "pointer",
                    borderColor: "#ff4d4f",
                    boxShadow: "0 0 0 2px rgba(255,77,79,0.2)",
                  }
                : { cursor: "pointer" }
            }
          >
            <Statistic title="On Leave" value={todayBreakdown.onLeave} valueStyle={{ color: "#ff4d4f" }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24}>
          <Card title="Present by designation (today)" size="small" loading={loading}>
            {designationBreakdown.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {designationBreakdown.map(({ designation, present, total }) => (
                  <div
                    key={designation}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <Text>{designation}</Text>
                    <Text strong>
                      {present}
                      <Text type="secondary" style={{ fontWeight: 400 }}>
                        {" "}
                        / {total}
                      </Text>
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary">No present staff today</Text>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="Mark Attendance"
        open={markModalOpen}
        onOk={handleMarkAttendance}
        onCancel={() => {
          setMarkModalOpen(false);
          markForm.resetFields();
        }}
        okText="Save"
        destroyOnClose
      >
        <Form form={markForm} layout="vertical" initialValues={{ date: dayjs() }}>
          <Form.Item
            label="Employee"
            name="workerEmail"
            rules={[{ required: true, message: "Please select employee" }]}
          >
            <Select
              showSearch
              placeholder="Select employee"
              optionFilterProp="label"
              options={activeEmployees.map((emp) => ({
                value: emp.email,
                label: `${emp.name} (${emp.employeeId})`,
              }))}
            />
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
