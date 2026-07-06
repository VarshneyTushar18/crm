import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Col,
  DatePicker,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
  Spin,
} from "antd";
import { getJobs } from "../Jobs/jobApi";
import { getEmployees } from "../Employee/employeeApi";
import { getProductivitySummary } from "./productivityApi";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const MODULE_OPTIONS = [
  { value: "", label: "All modules" },
  { value: "fabrication", label: "Fabrication" },
  { value: "installation", label: "Installation" },
  { value: "attendance", label: "Attendance" },
];

const MODULE_COLORS = {
  Fabrication: "cyan",
  "Installation (Job Card)": "blue",
  "Installation (Activity)": "geekblue",
  Attendance: "gold",
};

export default function Productivity() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    jobId: undefined,
    workerName: undefined,
    module: undefined,
    dateRange: null,
  });

  const loadFilters = async () => {
    try {
      const [jobList, employeeList] = await Promise.all([getJobs(), getEmployees()]);
      setJobs(Array.isArray(jobList) ? jobList : []);
      setEmployees(Array.isArray(employeeList) ? employeeList : employeeList?.result || []);
    } catch {
      setJobs([]);
      setEmployees([]);
    }
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const params = {
        jobId: filters.jobId,
        workerName: filters.workerName,
        module: filters.module,
        startDate: filters.dateRange?.[0]
          ? filters.dateRange[0].format("YYYY-MM-DD")
          : undefined,
        endDate: filters.dateRange?.[1]
          ? filters.dateRange[1].format("YYYY-MM-DD")
          : undefined,
      };
      const result = await getProductivitySummary(params);
      setData(result);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load productivity data");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const moduleTags = useMemo(() => {
    const byModule = data?.summary?.byModule || {};
    return Object.entries(byModule).map(([name, hours]) => ({ name, hours }));
  }, [data]);

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ marginBottom: 4 }}>
        Productivity & Time Tracking
      </Title>
      <Text type="secondary">
        Unified hours from fabrication, installation job cards, installation activities, and attendance.
      </Text>

      <Card style={{ marginTop: 16, marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Text strong>Job</Text>
            <Select
              allowClear
              showSearch
              placeholder="All jobs"
              style={{ width: "100%", marginTop: 8 }}
              value={filters.jobId}
              onChange={(value) => setFilters((prev) => ({ ...prev, jobId: value }))}
              optionFilterProp="children"
            >
              {jobs.map((job) => (
                <Option key={job._id} value={job._id}>
                  {job.jobId} — {job.customer || "No customer"}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <Text strong>Worker</Text>
            <Select
              allowClear
              showSearch
              placeholder="All workers"
              style={{ width: "100%", marginTop: 8 }}
              value={filters.workerName}
              onChange={(value) => setFilters((prev) => ({ ...prev, workerName: value }))}
              optionFilterProp="children"
            >
              {employees.map((emp) => (
                <Option key={emp._id} value={emp.name}>
                  {emp.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <Text strong>Module</Text>
            <Select
              allowClear
              placeholder="All modules"
              style={{ width: "100%", marginTop: 8 }}
              value={filters.module}
              onChange={(value) => setFilters((prev) => ({ ...prev, module: value }))}
            >
              {MODULE_OPTIONS.filter((opt) => opt.value !== "").map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <Text strong>Date range</Text>
            <RangePicker
              style={{ width: "100%", marginTop: 8 }}
              value={filters.dateRange}
              onChange={(value) => setFilters((prev) => ({ ...prev, dateRange: value }))}
              format="DD-MM-YYYY"
            />
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Card><Statistic title="Total Hours" value={data?.summary?.totalHours || 0} precision={1} /></Card>
          </Col>
          <Col xs={12} md={6}>
            <Card><Statistic title="Workers" value={data?.summary?.workerCount || 0} /></Card>
          </Col>
          <Col xs={12} md={6}>
            <Card><Statistic title="Jobs" value={data?.summary?.jobCount || 0} /></Card>
          </Col>
          <Col xs={12} md={6}>
            <Card><Statistic title="Entries" value={data?.summary?.entryCount || 0} /></Card>
          </Col>
        </Row>

        <Card title="Hours by Module" style={{ marginTop: 16 }}>
          <Space wrap>
            {moduleTags.length ? (
              moduleTags.map((item) => (
                <Tag key={item.name} color={MODULE_COLORS[item.name] || "default"}>
                  {item.name}: {Number(item.hours).toFixed(1)}h
                </Tag>
              ))
            ) : (
              <Text type="secondary">No hours recorded for the selected filters.</Text>
            )}
          </Space>
        </Card>

        <Card title="By Worker" style={{ marginTop: 16 }}>
          <Table
            rowKey={(row) => row.workerName}
            dataSource={data?.byWorker || []}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: "Worker", dataIndex: "workerName" },
              { title: "Total Hours", dataIndex: "totalHours", width: 120 },
              { title: "Fabrication", dataIndex: "fabricationHours", width: 120 },
              { title: "Installation", dataIndex: "installationHours", width: 120 },
              { title: "Attendance", dataIndex: "attendanceHours", width: 120 },
              { title: "Entries", dataIndex: "entries", width: 90 },
            ]}
          />
        </Card>

        <Card title="By Job" style={{ marginTop: 16 }}>
          <Table
            rowKey={(row) => row.jobId}
            dataSource={data?.byJob || []}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: "Job", dataIndex: "jobCode", width: 140 },
              { title: "Customer", dataIndex: "customer" },
              { title: "Total Hours", dataIndex: "totalHours", width: 120 },
              { title: "Workers", dataIndex: "workerCount", width: 100 },
              {
                title: "Team",
                dataIndex: "workers",
                render: (workers) =>
                  Array.isArray(workers) && workers.length
                    ? workers.map((name) => <Tag key={name}>{name}</Tag>)
                    : "—",
              },
            ]}
          />
        </Card>

        <Card title="Detailed Entries" style={{ marginTop: 16 }}>
          <Table
            rowKey={(_, index) => index}
            dataSource={data?.entries || []}
            pagination={{ pageSize: 15 }}
            scroll={{ x: 1100 }}
            columns={[
              { title: "Date", dataIndex: "workDate", width: 110 },
              { title: "Worker", dataIndex: "workerName", width: 140 },
              { title: "Hours", dataIndex: "hours", width: 80 },
              {
                title: "Module",
                dataIndex: "module",
                width: 180,
                render: (value) => (
                  <Tag color={MODULE_COLORS[value] || "default"}>{value}</Tag>
                ),
              },
              { title: "Job", dataIndex: "jobCode", width: 130 },
              { title: "Reference", dataIndex: "reference", width: 180 },
              { title: "Role", dataIndex: "role", width: 100 },
              { title: "Notes", dataIndex: "notes", ellipsis: true },
            ]}
          />
        </Card>
      </Spin>
    </div>
  );
}
