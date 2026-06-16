import { useEffect, useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Popconfirm,
  message,
  Empty,
  Descriptions,
  Spin,
  DatePicker,
} from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import { useJob } from "../../context/JobContext";
import { getJobs, updateJob } from "../Jobs/jobApi";
import {
  getKanbanTasks,
  createKanbanTask,
  updateKanbanTask,
  deleteKanbanTask,
} from "./kanbanApi";

const { Option } = Select;
const { TextArea } = Input;

const BOARD_COLUMNS = [
  "To Schedule",
  "Scheduled",
  "Material Purchase",
  "Fabrication",
  "QC",
  "Ready for Installation",
  "Completed",
];

const JOB_STAGE_COLORS = {
  Backlog: "default",
  "Site Measurement": "blue",
  "Planning Lock": "purple",
  Drafting: "orange",
  "Job Scheduling": "gold",
  "Material Purchase": "lime",
  Fabrication: "cyan",
  "Quality Control": "magenta",
  Installation: "green",
  Closure: "volcano",
};

const JOB_STATUS_COLORS = {
  Backlog: "default",
  Active: "green",
  "On Hold": "orange",
  Completed: "red",
};

const KANBAN_STATUS_STYLES = {
  "To Schedule": {
    color: "#595959",
    backgroundColor: "#f5f5f5",
    borderColor: "#d9d9d9",
  },
  Scheduled: {
    color: "#0958d9",
    backgroundColor: "#e6f4ff",
    borderColor: "#91caff",
  },
  "Material Purchase": {
    color: "#7cb305",
    backgroundColor: "#fcffe6",
    borderColor: "#d3f261",
  },
  Fabrication: {
    color: "#08979c",
    backgroundColor: "#e6fffb",
    borderColor: "#87e8de",
  },
  QC: {
    color: "#c41d7f",
    backgroundColor: "#fff0f6",
    borderColor: "#ffadd2",
  },
  "Ready for Installation": {
    color: "#389e0d",
    backgroundColor: "#f6ffed",
    borderColor: "#b7eb8f",
  },
  Completed: {
    color: "#cf1322",
    backgroundColor: "#fff1f0",
    borderColor: "#ffa39e",
  },
};

const statusTagStyle = (status) => ({
  ...(KANBAN_STATUS_STYLES[status] || KANBAN_STATUS_STYLES["To Schedule"]),
  border: "1px solid",
  fontWeight: 500,
});

const mapKanbanStatusToJobStage = (status) => {
  switch (status) {
    case "To Schedule":
    case "Scheduled":
      return "Job Scheduling";
    case "Material Purchase":
      return "Material Purchase";
    case "Fabrication":
      return "Fabrication";
    case "QC":
      return "Quality Control";
    case "Ready for Installation":
      return "Installation";
    case "Completed":
      return "Closure";
    default:
      return "Job Scheduling";
  }
};

const mapKanbanStatusToJobStatus = (status) => {
  if (status === "Completed") return "Completed";
  return "Active";
};

export default function Kanban() {
  const navigate = useNavigate();
  const location = useLocation();

  const { activeJobId, setActiveJobId } = useJob();

  const [jobs, setJobs] = useState([]);
  const [jobData, setJobData] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const queryJobId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("jobId");
  }, [location.search]);

  const jobId = queryJobId || activeJobId || localStorage.getItem("activeJobId");
  const jobKey = jobId ? `activeJobData_${jobId}` : null;

  const eligibleJobs = useMemo(() => {
    return jobs.filter((job) =>
      [
        "Job Scheduling",
        "Material Purchase",
        "Fabrication",
        "Quality Control",
        "Installation",
        "Closure",
      ].includes(job.stage)
    );
  }, [jobs]);

  const fetchJobs = async () => {
    try {
      setLoadingJobs(true);
      const result = await getJobs();
      setJobs(Array.isArray(result) ? result : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to load jobs"
      );
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  const setCurrentJobContext = (job) => {
    if (!job?._id) return;

    setActiveJobId(job._id);
    localStorage.setItem("activeJobId", job._id);
    localStorage.setItem(`activeJobData_${job._id}`, JSON.stringify(job));
    localStorage.setItem("activeJobData", JSON.stringify(job));
    setJobData(job);
  };

  const resolveJobData = async (resolvedJobId) => {
    if (!resolvedJobId) {
      setJobData(null);
      return null;
    }

    const incomingJob = location.state?.job || location.state?.fromJob;

    if (incomingJob && incomingJob._id === resolvedJobId) {
      setCurrentJobContext(incomingJob);
      return incomingJob;
    }

    const saved = jobKey ? localStorage.getItem(jobKey) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?._id === resolvedJobId) {
          setCurrentJobContext(parsed);
          return parsed;
        }
      } catch {}
    }

    const allJobs = jobs.length ? jobs : await getJobs();
    const matched = Array.isArray(allJobs)
      ? allJobs.find((j) => j._id === resolvedJobId)
      : null;

    if (matched) {
      setCurrentJobContext(matched);
      return matched;
    }

    return null;
  };

  const fetchTasks = async (resolvedJobId) => {
    if (!resolvedJobId) {
      setTasks([]);
      return;
    }

    setLoadingTasks(true);
    try {
      const data = await getKanbanTasks(resolvedJobId);
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to fetch scheduling records"
      );
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!jobId) {
        setJobData(null);
        setTasks([]);
        return;
      }

      const job = await resolveJobData(jobId);

      if (!job) {
        message.warning("Please select a job first");
        return;
      }

      if (
        ![
          "Job Scheduling",
          "Material Purchase",
          "Fabrication",
          "Quality Control",
          "Installation",
          "Closure",
        ].includes(job.stage)
      ) {
        message.warning(
          "This job is not eligible for Job Scheduling. Complete Drafting / IFC approval first."
        );
        setJobData(null);
        setTasks([]);
        navigate("/admin/kanban");
        return;
      }

      await fetchTasks(jobId);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, location.state, jobs.length]);

  const onJobChange = (selectedJobId) => {
    if (!selectedJobId) {
      setJobData(null);
      setTasks([]);
      localStorage.removeItem("activeJobId");
      navigate("/admin/kanban");
      return;
    }

    const selectedJob = eligibleJobs.find((j) => j._id === selectedJobId);

    if (!selectedJob) {
      message.warning("Only scheduling-eligible jobs are allowed here");
      return;
    }

    setCurrentJobContext(selectedJob);

    navigate(`/admin/kanban?jobId=${selectedJobId}`, {
      state: { job: selectedJob },
    });
  };

  const grouped = useMemo(() => {
    const map = {};
    BOARD_COLUMNS.forEach((c) => (map[c] = []));
    tasks.forEach((t) => {
      const key = BOARD_COLUMNS.includes(t.status) ? t.status : "To Schedule";
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  const onAddTask = async (values) => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    const payload = {
      jobId,
      title: values.title,
      description: values.description || "",
      plannedStart: values.plannedStart
        ? values.plannedStart.format("YYYY-MM-DD")
        : "",
      plannedEnd: values.plannedEnd
        ? values.plannedEnd.format("YYYY-MM-DD")
        : "",
      priority: values.priority || "Medium",
      assignedTeam: values.assignedTeam || "",
      status: "To Schedule",
    };

    try {
      const created = await createKanbanTask(payload);

      if (!created?._id) {
        throw new Error("Scheduling record was not saved properly");
      }

      setTasks((prev) => [created, ...prev]);
      message.success("Scheduling task added");

      if (jobData) {
        const updatedJobData = {
          ...jobData,
          stage: "Job Scheduling",
          status: "Active",
        };
        setCurrentJobContext(updatedJobData);
      }

      await fetchTasks(jobId);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Task add failed"
      );
    }

    setOpen(false);
    form.resetFields();
  };

  const moveTask = async (task, newStatus) => {
    const oldStatus = task.status;

    setTasks((prev) =>
      prev.map((t) => (t._id === task._id ? { ...t, status: newStatus } : t))
    );

    try {
      if (!String(task._id).startsWith("tmp_")) {
        await updateKanbanTask(task._id, { status: newStatus });
      }

      if (jobId) {
        const newJobStage = mapKanbanStatusToJobStage(newStatus);
        const newJobStatus = mapKanbanStatusToJobStatus(newStatus);

        await updateJob(jobId, {
          stage: newJobStage,
          status: newJobStatus,
        });

        if (jobData) {
          const updatedJobData = {
            ...jobData,
            stage: newJobStage,
            status: newJobStatus,
          };
          setCurrentJobContext(updatedJobData);
        }
      }

      await fetchTasks(jobId);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Move failed"
      );
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? { ...t, status: oldStatus } : t))
      );
    }
  };

  const removeTask = async (task) => {
    const oldTasks = tasks;
    setTasks((prev) => prev.filter((t) => t._id !== task._id));

    try {
      if (!String(task._id).startsWith("tmp_")) {
        await deleteKanbanTask(task._id);
      }
      message.success("Deleted");
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Delete failed"
      );
      setTasks(oldTasks);
    }
  };

  const isEmpty = !loadingTasks && tasks.length === 0;

  return (
    <div className="page-shell">
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
        align="start"
        wrap
      >
        <div>
          <h2 style={{ margin: 0 }}>Job Scheduling / Kanban</h2>
          <div style={{ color: "#666", marginTop: 4 }}>
            Only drafting-completed jobs are available here.
          </div>
        </div>

        <Space wrap>
          <Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>
          <Button
            type="primary"
            onClick={() => {
              if (!jobId) {
                message.warning("Please select a job first");
                return;
              }
              setOpen(true);
            }}
          >
            + Add Scheduling Task
          </Button>
        </Space>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12} lg={10}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Search Eligible Job</div>
            <Select
              showSearch
              allowClear
              placeholder="Select eligible job"
              style={{ width: "100%" }}
              value={jobId || undefined}
              onChange={onJobChange}
              loading={loadingJobs}
              optionFilterProp="children"
            >
              {eligibleJobs.map((job) => (
                <Option key={job._id} value={job._id}>
                  {job.jobId} - {job.customer || "No customer"}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} md={12} lg={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Current Selection</div>
            <Input
              readOnly
              value={
                jobData
                  ? `${jobData.jobId || "-"} | ${jobData.customer || "-"}`
                  : ""
              }
              placeholder="No eligible job selected"
            />
          </Col>

          <Col xs={24} lg={6}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Scheduling Status</div>
            {tasks.length > 0 ? (
              <Tag color="green">Scheduling Tasks Available</Tag>
            ) : (
              <Tag color="orange">No Scheduling Tasks</Tag>
            )}
          </Col>
        </Row>
      </Card>

      {!jobId ? (
        <Card>
          <Empty description="Please select an eligible job to continue." />
        </Card>
      ) : !jobData ? (
        <Card>
          <Spin />
        </Card>
      ) : (
        <>
          <Card title="Job Summary" style={{ marginBottom: 16 }}>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2, lg: 2 }}>
              <Descriptions.Item label="Job">
                {jobData?.jobId || jobData?._id || jobId}
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {jobData?.customer || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Site" span={2}>
                {jobData?.site || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Stage">
                <Tag color={JOB_STAGE_COLORS[jobData?.stage] || "default"}>
                  {jobData?.stage || "-"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={JOB_STATUS_COLORS[jobData?.status] || "default"}>
                  {jobData?.status || "-"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {isEmpty ? (
            <Card>
              <Empty description="No scheduling tasks currently for this job." />
            </Card>
          ) : (
            <div className="kanban-board-scroll">
            <Row gutter={16} className="kanban-board-row">
              {BOARD_COLUMNS.map((col) => (
                <Col flex="0 0 260px" className="kanban-column" key={col}>
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>
                    <Tag style={statusTagStyle(col)}>{col}</Tag>{" "}
                    <Tag>{grouped[col]?.length || 0}</Tag>
                  </div>

                  {(grouped[col] || []).map((task) => (
                    <Card
                      key={task._id}
                      size="small"
                      loading={loadingTasks}
                      style={{ marginBottom: 10 }}
                      title={task.title}
                      extra={<Tag style={statusTagStyle(task.status)}>{task.status}</Tag>}
                    >
                      <div style={{ marginBottom: 8 }}>{task.description || "-"}</div>

                      <div style={{ marginBottom: 6 }}>
                        <strong>Priority:</strong> {task.priority || "-"}
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <strong>Team:</strong> {task.assignedTeam || "-"}
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <strong>Schedule:</strong>{" "}
                        {task.plannedStart || "-"} → {task.plannedEnd || "-"}
                      </div>

                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Select
                          value={task.status}
                          style={{ width: "100%" }}
                          onChange={(v) => moveTask(task, v)}
                        >
                          {BOARD_COLUMNS.map((s) => (
                            <Option key={s} value={s}>
                              {s}
                            </Option>
                          ))}
                        </Select>

                        <Popconfirm
                          title="Delete this task?"
                          onConfirm={() => removeTask(task)}
                        >
                          <Button danger size="small" block>
                            Delete
                          </Button>
                        </Popconfirm>
                      </Space>
                    </Card>
                  ))}
                </Col>
              ))}
            </Row>
            </div>
          )}
        </>
      )}

      <Modal
        title="Add Scheduling Task"
        open={open}
        onCancel={() => {
          setOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onAddTask}>
          <Form.Item
            name="title"
            label="Task Title"
            rules={[{ required: true, message: "Please enter task title" }]}
          >
            <Input placeholder="e.g. Allocate fabrication slot" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Optional details..." />
          </Form.Item>

          <Form.Item name="plannedStart" label="Planned Start">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="plannedEnd" label="Planned End">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="priority" label="Priority">
            <Select placeholder="Select priority">
              <Option value="Low">Low</Option>
              <Option value="Medium">Medium</Option>
              <Option value="High">High</Option>
              <Option value="Urgent">Urgent</Option>
            </Select>
          </Form.Item>

          <Form.Item name="assignedTeam" label="Assigned Team / Crew">
            <Input placeholder="e.g. Team A / Fabrication Crew 1" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}