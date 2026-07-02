import { useEffect, useMemo, useState } from "react";
import {
  Button,
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

export default function Scheduling() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeJobId, setActiveJobId } = useJob();

  const [jobs, setJobs] = useState([]);
  const [jobData, setJobData] = useState(null);
  const [items, setItems] = useState([]);
  const [calendarItems, setCalendarItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const [view, setView] = useState("list");
  const [range, setRange] = useState([dayjs().startOf("week"), dayjs().endOf("week")]);

  const queryJobId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("jobId");
  }, [location.search]);

  const jobId = queryJobId || activeJobId || localStorage.getItem("activeJobId");

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

  const fetchItems = async (id = jobId) => {
    if (!id) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getScheduleByJob(id);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load schedule");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendar = async () => {
    try {
      const [from, to] = range || [];
      const data = await getScheduleCalendar({
        from: from?.toISOString(),
        to: to?.toISOString(),
        jobId: jobId || undefined,
      });
      setCalendarItems(Array.isArray(data) ? data : []);
    } catch {
      setCalendarItems([]);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const matched = jobs.find((j) => j._id === jobId);
    if (matched) {
      setJobData(matched);
      setActiveJobId(matched._id);
    }
    fetchItems(jobId);
  }, [jobId, jobs.length]);

  useEffect(() => {
    if (view === "calendar") fetchCalendar();
  }, [view, range, jobId]);

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
      await fetchItems(jobId);
      if (view === "calendar") await fetchCalendar();
    } catch (err) {
      message.error(err?.response?.data?.message || "Save failed");
    }
  };

  const onDelete = async (record) => {
    try {
      await deleteScheduleAssignment(record._id);
      message.success("Assignment deleted");
      await fetchItems(jobId);
      if (view === "calendar") await fetchCalendar();
    } catch (err) {
      message.error(err?.response?.data?.message || "Delete failed");
    }
  };

  const columns = [
    { title: "Title", dataIndex: "title" },
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

  return (
    <div className="page-shell">
      <div className="page-shell__header">
        <div>
          <h2 className="page-shell__title">Scheduling</h2>
          <div style={{ color: "#666" }}>
            Assign jobs to engineers, drafters, fabricators, and installers.
          </div>
        </div>
        <Space wrap>
          <Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>
          <Button type="primary" onClick={openCreate}>
            + Schedule Assignment
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Job</div>
            <Select
              showSearch
              allowClear
              style={{ width: "100%" }}
              placeholder="Select job"
              value={jobId || undefined}
              onChange={(v) => navigate(v ? `/admin/scheduling?jobId=${v}` : "/admin/scheduling")}
              optionFilterProp="children"
            >
              {jobs.map((job) => (
                <Option key={job._id} value={job._id}>
                  {job.jobId} - {job.customer || "No customer"}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Calendar Range</div>
            <RangePicker
              style={{ width: "100%" }}
              value={range}
              onChange={(v) => setRange(v)}
            />
          </Col>
        </Row>
      </Card>

      <Tabs
        activeKey={view}
        onChange={setView}
        items={[
          {
            key: "list",
            label: "List View",
            children: jobId ? (
              <div className="table-responsive-wrap">
                <Table
                  rowKey="_id"
                  loading={loading}
                  columns={columns}
                  dataSource={items}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: "max-content" }}
                />
              </div>
            ) : (
              <Empty description="Select a job to view schedule assignments" />
            ),
          },
          {
            key: "calendar",
            label: "Calendar View",
            children: (
              <div className="table-responsive-wrap">
                <Table
                  rowKey="_id"
                  columns={columns}
                  dataSource={calendarItems}
                  pagination={{ pageSize: 15 }}
                  scroll={{ x: "max-content" }}
                />
              </div>
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
            <Col span={12}>
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
