import { useEffect, useMemo, useState } from "react";
import {
  Badge,
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
  Upload,
  message,
  Alert,
} from "antd";
import { EyeOutlined, UploadOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { buildFileUrl } from "@/config/serverApiConfig";
import { useJob } from "../../context/JobContext";
import { getJobs } from "../Jobs/jobApi";
import { getEmployees } from "../Employee/employeeApi";
import {
  createScheduleAssignment,
  deleteScheduleAssignment,
  getScheduleByJob,
  getScheduleCalendar,
  updateScheduleAssignment,
  uploadScheduleAttachments,
  completeSchedulingForJob,
} from "../../api/extensionApi";

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const ROLES = ["Site Engineer", "Drafter", "Fabricator", "Installer", "Other"];
const TYPES = ["SiteMeasurement", "Drafting", "Fabrication", "Installation", "General"];
const STATUSES = ["Scheduled", "In Progress", "Completed", "Cancelled", "Delayed"];
const DEFAULT_TEAMS = [
  "Install Team A",
  "Install Team B",
  "Fab Team",
  "QC Team",
  "Procurement",
  "Site Crew",
];

const STATUS_BADGE = {
  Scheduled: "processing",
  "In Progress": "warning",
  Completed: "success",
  Cancelled: "default",
  Delayed: "error",
};

const formatAssignees = (record) => {
  const people = Array.isArray(record?.assignees)
    ? record.assignees.map((a) => a.assigneeName).filter(Boolean)
    : [];
  if (people.length) return people.join(", ");
  return record?.assigneeName || "—";
};

const formatTeams = (record) => {
  const teams = Array.isArray(record?.teams) ? record.teams.filter(Boolean) : [];
  return teams.length ? teams.join(", ") : "—";
};

const sameDay = (a, b) => dayjs(a).isSame(dayjs(b), "day");

export default function Scheduling() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveJobId } = useJob();

  const [jobs, setJobs] = useState([]);
  const [jobData, setJobData] = useState(null);
  const [items, setItems] = useState([]);
  const [jobAssignmentCount, setJobAssignmentCount] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [form] = Form.useForm();
  const [view, setView] = useState("list");
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [workerFilter, setWorkerFilter] = useState(undefined);
  const [teamFilter, setTeamFilter] = useState(undefined);
  const [calendarValue, setCalendarValue] = useState(dayjs());

  const queryJobId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("jobId");
  }, [location.search]);

  // Job filter is URL-only — do not inherit activeJobId / localStorage by default
  const jobId = queryJobId || undefined;

  const jobLabelById = useMemo(() => {
    const map = {};
    jobs.forEach((job) => {
      map[job._id] = `${job.jobId || job._id}${job.customer ? ` - ${job.customer}` : ""}`;
    });
    return map;
  }, [jobs]);

  const teamOptions = useMemo(() => {
    const fromItems = items.flatMap((item) =>
      Array.isArray(item.teams) ? item.teams.filter(Boolean) : []
    );
    return [...new Set([...DEFAULT_TEAMS, ...fromItems])];
  }, [items]);

  const fetchJobs = async () => {
    const result = await getJobs();
    setJobs(Array.isArray(result) ? result : []);
  };

  const fetchEmployees = async () => {
    try {
      const res = await getEmployees();
      const list = Array.isArray(res?.result) ? res.result : Array.isArray(res) ? res : [];
      setEmployees(list);
    } catch {
      setEmployees([]);
    }
  };

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const params = {
        jobId: jobId || undefined,
        status: statusFilter || undefined,
        assigneeId: workerFilter || undefined,
        team: teamFilter || undefined,
      };
      if (dateFrom) params.from = dateFrom.startOf("day").toISOString();
      if (dateTo) params.to = dateTo.endOf("day").toISOString();
      const data = await getScheduleCalendar(params);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load schedule");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshJobScopedMeta = async (id = jobId) => {
    if (!id) {
      setJobData(null);
      setJobAssignmentCount(0);
      return;
    }
    try {
      const [jobList, jobItems] = await Promise.all([getJobs(), getScheduleByJob(id)]);
      const list = Array.isArray(jobList) ? jobList : [];
      setJobs(list);
      const matched = list.find((j) => j._id === id);
      if (matched) {
        setJobData(matched);
        setActiveJobId(matched._id);
      }
      setJobAssignmentCount(Array.isArray(jobItems) ? jobItems.length : 0);
    } catch {
      setJobAssignmentCount(0);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [dateFrom, dateTo, jobId, statusFilter, workerFilter, teamFilter]);

  useEffect(() => {
    refreshJobScopedMeta(jobId);
  }, [jobId]);

  useEffect(() => {
    if (dateFrom) setCalendarValue(dateFrom);
  }, [dateFrom]);

  const openCreate = () => {
    if (!jobId) {
      message.warning("Select a job first");
      return;
    }
    setEditing(null);
    setAttachments([]);
    setPendingFiles([]);
    form.resetFields();
    form.setFieldsValue({
      status: "Scheduled",
      assignmentType: "General",
      role: "Site Engineer",
      priority: 3,
      timeRange: [dayjs().hour(9).minute(0), dayjs().hour(17).minute(0)],
      travelTimeMinutes: 0,
    });
    setOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setAttachments(Array.isArray(record.attachments) ? record.attachments : []);
    setPendingFiles([]);
    form.setFieldsValue({
      title: record.title,
      assignmentType: record.assignmentType,
      role: record.role,
      teams: Array.isArray(record.teams) ? record.teams : [],
      assigneeIds: Array.isArray(record.assignees)
        ? record.assignees.map((a) => a.assigneeId).filter(Boolean)
        : record.assigneeId
        ? [record.assigneeId]
        : [],
      status: record.status,
      priority: record.priority ?? 3,
      location: record.location,
      notes: record.notes,
      travelTimeMinutes: record.travelTimeMinutes,
      timeRange: [dayjs(record.startTime), dayjs(record.endTime)],
    });
    setOpen(true);
  };

  const viewAttachment = (fileUrl) => {
    const url = buildFileUrl(fileUrl);
    if (!url) {
      message.warning("File not available");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const viewPendingFile = (file) => {
    if (!file) {
      message.warning("File not available");
      return;
    }
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const uploadPendingFiles = async (assignmentId) => {
    if (!pendingFiles.length || !assignmentId) return;
    setUploading(true);
    try {
      const updated = await uploadScheduleAttachments(assignmentId, pendingFiles);
      setAttachments(updated?.attachments || []);
      setPendingFiles([]);
      message.success("Attachments uploaded");
    } catch (err) {
      message.error(err?.response?.data?.message || "Attachment upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values) => {
    const [start, end] = values.timeRange || [];
    const selectedIds = Array.isArray(values.assigneeIds) ? values.assigneeIds : [];
    const assignees = selectedIds.map((id) => {
      const employee = employees.find((e) => e._id === id);
      return {
        assigneeId: id,
        assigneeName: employee?.name || "",
      };
    });

    const payload = {
      jobId,
      title: values.title,
      assignmentType: values.assignmentType,
      role: values.role,
      teams: Array.isArray(values.teams) ? values.teams : [],
      assignees,
      assigneeId: assignees[0]?.assigneeId || null,
      assigneeName:
        assignees.map((a) => a.assigneeName).filter(Boolean).join(", ") ||
        (Array.isArray(values.teams) ? values.teams.join(", ") : ""),
      startTime: start?.toISOString(),
      endTime: end?.toISOString(),
      travelTimeMinutes: Number(values.travelTimeMinutes || 0),
      priority: Number(values.priority || 3),
      status: values.status,
      location: values.location || jobData?.site || "",
      latitude: values.latitude != null ? Number(values.latitude) : null,
      longitude: values.longitude != null ? Number(values.longitude) : null,
      notes: values.notes || "",
      workflowStageKey: "scheduling",
    };

    try {
      if (editing?._id) {
        await updateScheduleAssignment(editing._id, payload);
        await uploadPendingFiles(editing._id);
        message.success("Assignment updated");
      } else {
        const res = await createScheduleAssignment(payload);
        const createdId = res?.result?._id;
        if (createdId && pendingFiles.length) {
          await uploadPendingFiles(createdId);
        }
        message.success("Assignment scheduled");
      }
      setOpen(false);
      await fetchSchedule();
      await refreshJobScopedMeta(jobId);
    } catch (err) {
      message.error(err?.response?.data?.message || "Save failed");
    }
  };

  const onDelete = async (record) => {
    try {
      await deleteScheduleAssignment(record._id);
      message.success("Assignment deleted");
      await fetchSchedule();
      await refreshJobScopedMeta(jobId);
    } catch (err) {
      message.error(err?.response?.data?.message || "Delete failed");
    }
  };

  const schedulingSeStatus = jobData?.workflowEvents?.scheduling?.siteEngineerStatus;
  const schedulingSeApproved = schedulingSeStatus === "Approved";
  const schedulingSePending = schedulingSeStatus === "Pending";

  const completeScheduling = async () => {
    if (!jobId) {
      message.warning("Select a job first");
      return;
    }
    if (!jobAssignmentCount) {
      message.warning("Add at least one schedule assignment first");
      return;
    }
    try {
      setCompleting(true);
      await completeSchedulingForJob(jobId);
      message.success("Scheduling sent to site engineer for approval");
      await fetchSchedule();
      await refreshJobScopedMeta(jobId);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to complete scheduling");
    } finally {
      setCompleting(false);
    }
  };

  const onCalendarPanelChange = (value) => {
    setCalendarValue(value);
  };

  const onCalendarSelect = (value) => {
    setCalendarValue(value);
  };

  const columns = [
    {
      title: "Job",
      key: "job",
      width: 180,
      render: (_, record) => {
        const id = record.jobId?._id || record.jobId;
        return jobLabelById[id] || id || "—";
      },
    },
    { title: "Title", dataIndex: "title" },
    {
      title: "Priority",
      dataIndex: "priority",
      width: 90,
      render: (v) => {
        const p = Number(v || 3);
        const color = p <= 1 ? "red" : p <= 2 ? "orange" : p <= 3 ? "blue" : "default";
        return <Tag color={color}>P{p}</Tag>;
      },
      sorter: (a, b) => Number(a.priority || 3) - Number(b.priority || 3),
    },
    { title: "Role", dataIndex: "role" },
    {
      title: "Teams",
      render: (_, record) => formatTeams(record),
    },
    {
      title: "Assignees",
      render: (_, record) => formatAssignees(record),
    },
    {
      title: "Start",
      dataIndex: "startTime",
      render: (v) => (v ? dayjs(v).format("DD MMM YYYY HH:mm") : "-"),
    },
    {
      title: "End",
      dataIndex: "endTime",
      render: (v) => (v ? dayjs(v).format("DD MMM YYYY HH:mm") : "-"),
    },
    { title: "Hours", dataIndex: "totalHours" },
    { title: "Travel (min)", dataIndex: "travelTimeMinutes" },
    {
      title: "ETA",
      dataIndex: "estimatedArrival",
      render: (v) => (v ? dayjs(v).format("DD MMM HH:mm") : "-"),
    },
    {
      title: "Maps",
      render: (_, record) =>
        record.mapsUrl || record.location ? (
          <Button
            size="small"
            type="link"
            onClick={() =>
              window.open(
                record.mapsUrl ||
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(record.location)}`,
                "_blank"
              )
            }
          >
            Open
          </Button>
        ) : (
          "-"
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s) => <Tag>{s}</Tag>,
    },
    {
      title: "Attachments",
      render: (_, record) => {
        const files = record.attachments || [];
        if (!files.length) return "-";
        return (
          <Space wrap>
            {files.map((file, index) => (
              <Button
                key={`${file.fileUrl}-${index}`}
                size="small"
                icon={<EyeOutlined />}
                onClick={() => viewAttachment(file.fileUrl)}
              >
                View{file.originalName ? ` (${file.originalName})` : ` ${index + 1}`}
              </Button>
            ))}
          </Space>
        );
      },
    },
    {
      title: "Actions",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Button size="small" danger onClick={() => onDelete(record)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  const dateCellRender = (value) => {
    const dayItems = items.filter((item) => sameDay(item.startTime, value));
    if (!dayItems.length) return null;
    return (
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          maxHeight: 72,
          overflow: "auto",
        }}
      >
        {dayItems.slice(0, 4).map((item) => (
          <li key={item._id} style={{ marginBottom: 2 }}>
            <Badge
              status={STATUS_BADGE[item.status] || "default"}
              text={
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, height: "auto", whiteSpace: "normal", textAlign: "left" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(item);
                  }}
                >
                  {item.title}
                </Button>
              }
            />
          </li>
        ))}
        {dayItems.length > 4 ? (
          <li style={{ fontSize: 12, color: "#888" }}>+{dayItems.length - 4} more</li>
        ) : null}
      </ul>
    );
  };

  const selectedDayItems = useMemo(
    () => items.filter((item) => sameDay(item.startTime, calendarValue)),
    [items, calendarValue]
  );

  const filterBar = (
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} lg={6}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Job</div>
          <Select
            showSearch
            allowClear
            style={{ width: "100%" }}
            placeholder="All jobs"
            value={jobId || undefined}
            onChange={(v) => {
              if (v) {
                setActiveJobId(v);
                navigate(`/admin/scheduling?jobId=${v}`);
              } else {
                setActiveJobId("");
                navigate("/admin/scheduling");
              }
            }}
            optionFilterProp="children"
          >
            {jobs.map((job) => (
              <Option key={job._id} value={job._id}>
                {job.jobId} - {job.customer || "No customer"}
              </Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} md={8} lg={6}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Status</div>
          <Select
            allowClear
            style={{ width: "100%" }}
            placeholder="All statuses"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </Col>
        <Col xs={24} md={8} lg={6}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Worker</div>
          <Select
            showSearch
            allowClear
            style={{ width: "100%" }}
            placeholder="All workers"
            value={workerFilter}
            onChange={setWorkerFilter}
            optionFilterProp="children"
          >
            {employees.map((e) => (
              <Option key={e._id} value={e._id}>
                {e.name} ({e.designation || "Employee"})
              </Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} md={8} lg={6}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Team</div>
          <Select
            showSearch
            allowClear
            style={{ width: "100%" }}
            placeholder="All teams"
            value={teamFilter}
            onChange={setTeamFilter}
            options={teamOptions.map((t) => ({ value: t, label: t }))}
          />
        </Col>
        <Col xs={24} md={8} lg={6}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Start date</div>
          <DatePicker
            allowClear
            style={{ width: "100%" }}
            value={dateFrom}
            placeholder="Any start"
            disabledDate={(current) =>
              !!(dateTo && current && current.isAfter(dateTo, "day"))
            }
            onChange={(v) => setDateFrom(v || null)}
          />
        </Col>
        <Col xs={24} md={8} lg={6}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>End date</div>
          <DatePicker
            allowClear
            style={{ width: "100%" }}
            value={dateTo}
            placeholder="Any end"
            disabledDate={(current) =>
              !!(dateFrom && current && current.isBefore(dateFrom, "day"))
            }
            onChange={(v) => setDateTo(v || null)}
          />
        </Col>
      </Row>
    </Card>
  );

  return (
    <div className="page-shell">
      <div className="page-shell__header">
        <div>
          <h2 className="page-shell__title">Scheduling</h2>
          <div style={{ color: "#666" }}>
            One schedule for all jobs. Filter by status, worker, team, and date — List and Calendar stay in sync.
          </div>
        </div>
        <Space wrap>
          <Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>
          <Button type="primary" onClick={openCreate} disabled={!jobId}>
            + Schedule Assignment
          </Button>
          <Button
            type="primary"
            onClick={completeScheduling}
            loading={completing}
            disabled={!jobId || !jobAssignmentCount || schedulingSeApproved}
          >
            Mark Scheduling Complete
          </Button>
        </Space>
      </div>

      {jobId && schedulingSePending ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Site engineer review pending"
          description="Scheduling was submitted. Waiting for site engineer approval in SE Approvals."
        />
      ) : null}

      {jobId && schedulingSeApproved ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="Scheduling approved by site engineer"
        />
      ) : null}

      {jobId && jobAssignmentCount > 0 && !schedulingSePending && !schedulingSeApproved ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Send to site engineer when schedule is ready"
          description='Click "Mark Scheduling Complete" to send this job to Site Engineer → Approvals (same as Planning).'
        />
      ) : null}

      {filterBar}

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
                  locale={{ emptyText: <Empty description="No assignments for these filters" /> }}
                />
              </div>
            ),
          },
          {
            key: "calendar",
            label: "Calendar View",
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                  <Card loading={loading} styles={{ body: { padding: 8 } }}>
                    <Calendar
                      value={calendarValue}
                      onSelect={onCalendarSelect}
                      onPanelChange={onCalendarPanelChange}
                      cellRender={(current, info) => {
                        if (info.type === "date") return dateCellRender(current);
                        return info.originNode;
                      }}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card
                    title={`Assignments — ${calendarValue.format("DD MMM YYYY")}`}
                    extra={<Tag>{selectedDayItems.length}</Tag>}
                  >
                    {selectedDayItems.length ? (
                      <List
                        dataSource={selectedDayItems}
                        renderItem={(item) => {
                          const id = item.jobId?._id || item.jobId;
                          return (
                            <List.Item
                              actions={[
                                <Button key="edit" type="link" size="small" onClick={() => openEdit(item)}>
                                  Edit
                                </Button>,
                              ]}
                            >
                              <List.Item.Meta
                                title={
                                  <Space wrap>
                                    <span>{item.title}</span>
                                    <Tag>{item.status}</Tag>
                                  </Space>
                                }
                                description={
                                  <>
                                    <div>{jobLabelById[id] || id}</div>
                                    <div>
                                      {dayjs(item.startTime).format("HH:mm")} –{" "}
                                      {dayjs(item.endTime).format("HH:mm")}
                                    </div>
                                    <div>{formatAssignees(item)}</div>
                                    <div>{formatTeams(item)}</div>
                                  </>
                                }
                              />
                            </List.Item>
                          );
                        }}
                      />
                    ) : (
                      <Empty description="No assignments on this day" />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "Edit Assignment" : "Schedule Assignment"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Site measurement visit" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                <Select options={ROLES.map((r) => ({ value: r, label: r }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignmentType" label="Type" rules={[{ required: true }]}>
                <Select options={TYPES.map((r) => ({ value: r, label: r }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="teams" label="Teams / Crews">
                <Select
                  mode="tags"
                  allowClear
                  showSearch
                  placeholder="Select or type team names"
                  optionFilterProp="children"
                >
                  {DEFAULT_TEAMS.map((team) => (
                    <Option key={team} value={team}>
                      {team}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="assigneeIds"
                label="Assignees"
                rules={[
                  {
                    validator: (_, value) => {
                      const teams = form.getFieldValue("teams") || [];
                      if ((value && value.length) || (teams && teams.length)) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error("Select at least one team or assignee")
                      );
                    },
                  },
                ]}
              >
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  placeholder="Select one or more employees"
                >
                  {employees.map((e) => (
                    <Option key={e._id} value={e._id}>
                      {e.name} ({e.designation || "Employee"})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="timeRange" label="Start / End" rules={[{ required: true }]}>
            <RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="travelTimeMinutes" label="Travel Time (minutes)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="priority"
                label="Priority"
                tooltip="1 = highest, 5 = lowest"
              >
                <InputNumber min={1} max={5} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="Status">
                <Select options={STATUSES.map((s) => ({ value: s, label: s }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="location" label="Location">
            <Input placeholder="Site address (used for Google Maps link)" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="latitude" label="Latitude (optional)">
                <InputNumber style={{ width: "100%" }} placeholder="e.g. -33.8688" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="longitude" label="Longitude (optional)">
                <InputNumber style={{ width: "100%" }} placeholder="e.g. 151.2093" />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
            Assign multiple teams and/or employees to the same schedule slot. Travel time uses the first assignee&apos;s previous job on the same day.
          </div>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Attachments (JPEG / PDF / Drawings)">
            <Upload
              multiple
              accept="image/*,.pdf,.dwg,.dxf"
              beforeUpload={() => false}
              fileList={pendingFiles.map((file, index) => ({
                uid: `${file.name}-${index}`,
                name: file.name,
                status: "done",
                originFileObj: file,
              }))}
              itemRender={(_originNode, file, _fileList, actions) => (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "4px 0",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {file.name}
                  </span>
                  <Space size="small">
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => viewPendingFile(file.originFileObj)}
                    >
                      View
                    </Button>
                    {actions.remove}
                  </Space>
                </div>
              )}
              onChange={(info) => {
                const files = info.fileList
                  .map((f) => f.originFileObj)
                  .filter(Boolean);
                setPendingFiles(files);
              }}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                Upload files
              </Button>
            </Upload>
            {pendingFiles.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                {pendingFiles.length} file(s) will upload when you save.
              </div>
            )}
            {attachments.length > 0 && (
              <List
                size="small"
                style={{ marginTop: 8 }}
                dataSource={attachments}
                renderItem={(file, index) => (
                  <List.Item
                    actions={[
                      <Button
                        key="view"
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => viewAttachment(file.fileUrl)}
                      >
                        View
                      </Button>,
                    ]}
                  >
                    {file.originalName || `Attachment ${index + 1}`}
                  </List.Item>
                )}
              />
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
