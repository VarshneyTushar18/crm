import { useEffect, useMemo, useState } from "react";
import {
  Table,
  Button,
  Select,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Space,
  Popconfirm,
  message,
  Empty,
  Card,
  Descriptions,
  Spin,
  Row,
  Col,
} from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import { useJob } from "../../context/JobContext";
import {
  getPlanningTasks,
  createPlanningTask,
  updatePlanningTask,
  deletePlanningTask,
} from "./planningApi";
import { getJobs, updateJob } from "../Jobs/jobApi";

const { Option } = Select;

const STAGE_COLORS = {
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

const STATUS_COLORS = {
  Backlog: "default",
  Active: "green",
  "On Hold": "orange",
  Completed: "red",
};

export default function Planning() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeJobId, setActiveJobId } = useJob();

  const [jobs, setJobs] = useState([]);
  const [jobData, setJobData] = useState(null);

  const [data, setData] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [completing, setCompleting] = useState(false);

  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const queryJobId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("jobId");
  }, [location.search]);

  const jobId = queryJobId || activeJobId || localStorage.getItem("activeJobId");
  const jobKey = jobId ? `activeJobData_${jobId}` : null;

  // ✅ only planning-eligible jobs
  const eligibleJobs = useMemo(() => {
    return jobs.filter(
      (job) => job?.workflowEvents?.siteMeasurement?.isCompleted
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
      setData([]);
      return;
    }

    setLoadingTasks(true);
    try {
      const tasks = await getPlanningTasks(resolvedJobId);
      setData(Array.isArray(tasks) ? tasks : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to fetch planning tasks"
      );
      setData([]);
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
        setData([]);
        return;
      }

      const job = await resolveJobData(jobId);

      if (!job) {
        message.warning("Please select a job first");
        return;
      }

      if (!job?.workflowEvents?.siteMeasurement?.isCompleted) {
        message.warning(
          "This job is not eligible for Planning. Complete Site Measurement first."
        );
        setJobData(null);
        setData([]);
        navigate("/admin/planning");
        return;
      }

      await fetchTasks(jobId);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, location.state, jobs.length]);

  const onJobChange = async (selectedJobId) => {
    if (!selectedJobId) {
      setJobData(null);
      setData([]);
      localStorage.removeItem("activeJobId");
      navigate("/admin/planning");
      return;
    }

    const selectedJob = eligibleJobs.find((j) => j._id === selectedJobId);

    if (!selectedJob) {
      message.warning("Only site measurement completed jobs are allowed in Planning");
      return;
    }

    setCurrentJobContext(selectedJob);

    navigate(`/admin/planning?jobId=${selectedJobId}`, {
      state: { job: selectedJob },
    });
  };

  const onAddTask = async (values) => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    const start = values?.range?.[0]?.format("YYYY-MM-DD");
    const end = values?.range?.[1]?.format("YYYY-MM-DD");

    const payload = {
      jobId,
      task: values.task,
      start,
      end,
      workers: values.workers,
      hours: values.hours,
      status: values.status,
    };

    try {
      const created = await createPlanningTask(payload);

      if (created?._id) {
        setData((prev) => [created, ...prev]);
      } else {
        setData((prev) => [{ _id: `tmp_${Date.now()}`, ...payload }, ...prev]);
      }

      message.success("Planning task added");

      if (jobData) {
        const updatedJobData = {
          ...jobData,
          stage: "Planning Lock",
          status: "Active",
        };
        setCurrentJobContext(updatedJobData);
      }
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Task add failed"
      );
    }

    setOpen(false);
    form.resetFields();
  };

  const updateStatus = async (taskRow, newStatus) => {
    const oldStatus = taskRow.status;

    setData((prev) =>
      prev.map((t) => (t._id === taskRow._id ? { ...t, status: newStatus } : t))
    );

    try {
      if (!String(taskRow._id).startsWith("tmp_")) {
        await updatePlanningTask(taskRow._id, { status: newStatus });
      }
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Status update failed"
      );

      setData((prev) =>
        prev.map((t) => (t._id === taskRow._id ? { ...t, status: oldStatus } : t))
      );
    }
  };

  const removeTask = async (taskRow) => {
    const old = data;

    setData((prev) => prev.filter((t) => t._id !== taskRow._id));

    try {
      if (!String(taskRow._id).startsWith("tmp_")) {
        await deletePlanningTask(taskRow._id);
      }
      message.success("Planning task deleted");
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Delete failed"
      );
      setData(old);
    }
  };

  const completePlanning = async () => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    try {
      setCompleting(true);

      const planningUpdate = {
        isCompleted: true,
        approvalDate: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        completedBy: "Planning Module",
      };

      await updateJob(jobId, {
        stage: "Drafting",
        status: "Active",
        workflowEvents: {
          ...jobData?.workflowEvents,
          planning: {
            ...jobData?.workflowEvents?.planning,
            ...planningUpdate,
          },
        },
      });

      if (jobData) {
        const updatedJobData = {
          ...jobData,
          stage: "Drafting",
          status: "Active",
          workflowEvents: {
            ...jobData.workflowEvents,
            planning: {
              ...jobData.workflowEvents?.planning,
              ...planningUpdate,
            },
          },
        };
        setCurrentJobContext(updatedJobData);
      }

      message.success("Planning completed. Job moved to Drafting.");
      navigate("/admin/jobs");
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to complete planning"
      );
    } finally {
      setCompleting(false);
    }
  };

  const columns = [
    { title: "Task", dataIndex: "task" },
    { title: "Start", dataIndex: "start" },
    { title: "End", dataIndex: "end" },
    { title: "Estimated employee requirement", dataIndex: "workers" },
    { title: "Estimated Hour requirement", dataIndex: "hours" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status) => (
        <Tag
          color={
            status === "Done"
              ? "green"
              : status === "In Progress"
              ? "blue"
              : "orange"
          }
        >
          {status || "-"}
        </Tag>
      ),
    },
    {
      title: "Update Status",
      render: (_, record) => (
        <Select
          value={record.status}
          style={{ width: 140 }}
          onChange={(v) => updateStatus(record, v)}
        >
          <Option value="Pending">Pending</Option>
          <Option value="In Progress">In Progress</Option>
          <Option value="Done">Done</Option>
        </Select>
      ),
    },
    {
      title: "Actions",
      render: (_, record) => (
        <Popconfirm title="Delete this task?" onConfirm={() => removeTask(record)}>
          <Button danger size="small">
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const isEmpty = !loadingTasks && data.length === 0;

  return (
    <div style={{ padding: 20 }}>
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
        align="start"
        wrap
      >
        <div>
          <h2 style={{ margin: 0 }}>Planning (Admin)</h2>
          <div style={{ color: "#666", marginTop: 4 }}>
            Only jobs with completed Site Measurement are available here.
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
            + Add Task
          </Button>
          <Button type="primary" onClick={completePlanning} loading={completing}>
            Mark Planning Complete
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
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Planning Status</div>
            {data.length > 0 ? (
              <Tag color="green">Planning Tasks Available</Tag>
            ) : (
              <Tag color="orange">No Planning Tasks</Tag>
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
            <Descriptions bordered size="small" column={2}>
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
                <Tag color={STAGE_COLORS[jobData?.stage] || "default"}>
                  {jobData?.stage || "-"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLORS[jobData?.status] || "default"}>
                  {jobData?.status || "-"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {isEmpty ? (
            <Card>
              <Empty description="No planning tasks currently for this job." />
            </Card>
          ) : (
            <Table
              columns={columns}
              dataSource={data}
              rowKey="_id"
              loading={loadingTasks}
              pagination={{ pageSize: 10 }}
            />
          )}
        </>
      )}

      <Modal
        title="Add Planning Task"
        open={open}
        onCancel={() => {
          setOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Save"
      >
        <Form form={form} layout="vertical" onFinish={onAddTask}>
          <Form.Item
            name="task"
            label="Task"
            rules={[{ required: true, message: "Task is required" }]}
          >
            <Input placeholder="e.g. Measurement review / team allocation" />
          </Form.Item>

          <Form.Item
            name="range"
            label="Start - End"
            rules={[{ required: true, message: "Select date range" }]}
          >
            <DatePicker.RangePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="workers"
            label="Estimated employee requirement"
            rules={[{ required: true, message: "Workers required" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="hours"
            label="Estimated Hour requirement"
            rules={[{ required: true, message: "Hours required" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: "Status is required" }]}
          >
            <Select placeholder="Select status">
              <Option value="Pending">Pending</Option>
              <Option value="In Progress">In Progress</Option>
              <Option value="Done">Done</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}