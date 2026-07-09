import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useNavigate } from "react-router-dom";
import { getJobs } from "@/pages/Jobs/jobApi";
import { getEmployees } from "@/pages/Employee/employeeApi";
import {
  createWorkerTask,
  deleteWorkerTask,
  getWorkerTaskReviewQueue,
  listWorkerTasks,
  reviewWorkerTask,
} from "@/api/workerTaskApi";
import { buildFileUrl } from "@/config/serverApiConfig";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const STATUS_COLORS = {
  Assigned: "blue",
  "In Progress": "processing",
  Submitted: "gold",
  Completed: "green",
  Rejected: "red",
  Cancelled: "default",
};

export default function WorkerTaskManager() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [queue, setQueue] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();
  const [reviewForm] = Form.useForm();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [tasksRes, queueRes, jobsRes, empRes] = await Promise.allSettled([
        listWorkerTasks(),
        getWorkerTaskReviewQueue(),
        getJobs(),
        getEmployees(),
      ]);

      const taskList = tasksRes.status === "fulfilled" ? tasksRes.value : [];
      const reviewList = queueRes.status === "fulfilled" ? queueRes.value : [];
      const jobList = jobsRes.status === "fulfilled" ? jobsRes.value : [];
      const empList = empRes.status === "fulfilled" ? empRes.value : [];

      setTasks(Array.isArray(taskList) ? taskList : []);
      setQueue(Array.isArray(reviewList) ? reviewList : []);
      setJobs(Array.isArray(jobList) ? jobList : []);
      const employeesRaw = Array.isArray(empList?.result)
        ? empList.result
        : Array.isArray(empList)
          ? empList
          : [];
      setEmployees(employeesRaw);

      const failed = [tasksRes, queueRes, jobsRes].filter((r) => r.status === "rejected");
      if (failed.length === 3) {
        const err = failed[0].reason;
        message.error(err?.response?.data?.message || "Failed to load tasks");
      } else if (failed.length) {
        message.warning("Some task data could not be loaded. Try Refresh.");
      }
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onAssigneePick = (workerKey) => {
    const emp = employees.find(
      (e) => String(e.employeeId || e.workerId || "") === String(workerKey || "")
    );
    if (!emp) return;
    form.setFieldsValue({
      assigneeWorkerId: emp.employeeId || emp.workerId || workerKey,
      assigneeName: emp.name || "",
      assigneeEmail: emp.email || "",
    });
  };

  const onCreate = async () => {
    try {
      const values = await form.validateFields();
      const checklist = String(values.checklistText || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((label) => ({ label, done: false }));

      await createWorkerTask({
        jobId: values.jobId || null,
        title: values.title,
        description: values.description || "",
        siteZone: values.siteZone || "",
        location: values.location || "",
        priority: values.priority || 3,
        expectedDurationMinutes: values.expectedDurationMinutes || 60,
        assigneeWorkerId: values.assigneeWorkerId || "",
        assigneeName: values.assigneeName || "",
        assigneeEmail: values.assigneeEmail || "",
        checklist,
      });
      message.success("Task assigned — worker will see it under My Tasks");
      setOpen(false);
      form.resetFields();
      await load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || "Failed to create task");
    }
  };

  const openReview = (task) => {
    setSelected(task);
    reviewForm.setFieldsValue({ decision: "approve", remarks: "" });
    setReviewOpen(true);
  };

  const onReview = async () => {
    try {
      const values = await reviewForm.validateFields();
      await reviewWorkerTask(selected._id, {
        decision: values.decision,
        remarks: values.remarks || "",
      });
      message.success(
        values.decision === "approve" ? "Task approved" : "Task rejected"
      );
      setReviewOpen(false);
      setSelected(null);
      await load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || "Review failed");
    }
  };

  const columns = [
    {
      title: "Task",
      dataIndex: "title",
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <Text type="secondary">{row.siteZone || row.location || "-"}</Text>
        </div>
      ),
    },
    {
      title: "Job",
      render: (_, row) => row.jobId?.jobId || "-",
    },
    {
      title: "Assignee",
      render: (_, row) =>
        row.assigneeName || row.assigneeWorkerId || "Unassigned",
    },
    {
      title: "Priority",
      dataIndex: "priority",
      width: 90,
      render: (v) => <Tag>P{v || 3}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (v) => <Tag color={STATUS_COLORS[v] || "default"}>{v}</Tag>,
    },
    {
      title: "Review",
      dataIndex: "reviewStatus",
      render: (v) => <Tag>{v || "None"}</Tag>,
    },
    {
      title: "Actions",
      render: (_, row) => (
        <Space wrap>
          {row.reviewStatus === "Pending Review" ? (
            <Button size="small" type="primary" onClick={() => openReview(row)}>
              Review
            </Button>
          ) : null}
          <Popconfirm
            title="Delete this task?"
            onConfirm={async () => {
              try {
                await deleteWorkerTask(row._id);
                message.success("Task deleted");
                await load();
              } catch (err) {
                message.error(err?.response?.data?.message || "Delete failed");
              }
            }}
          >
            <Button size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-shell">
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
        wrap
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Task / Job Management
          </Title>
          <Text type="secondary">
            Assign tasks from admin — they sync live to the worker&apos;s My Tasks tab.
            {user?.role ? ` Signed in as ${user.role}.` : ""}
          </Text>
        </div>
        <Space wrap>
          <Button onClick={() => navigate(-1)}>Back</Button>
          <Button onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" onClick={() => setOpen(true)}>
            + Assign Task
          </Button>
        </Space>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Text type="secondary">Open tasks</Text>
            <Title level={3} style={{ margin: 0 }}>
              {
                tasks.filter((t) =>
                  ["Assigned", "In Progress", "Submitted", "Rejected"].includes(
                    t.status
                  )
                ).length
              }
            </Title>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Text type="secondary">Pending review</Text>
            <Title level={3} style={{ margin: 0 }}>
              {queue.length}
            </Title>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Text type="secondary">Completed</Text>
            <Title level={3} style={{ margin: 0 }}>
              {tasks.filter((t) => t.status === "Completed").length}
            </Title>
          </Card>
        </Col>
      </Row>

      <Card title={`Review Queue (${queue.length})`} style={{ marginBottom: 16 }}>
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={queue}
          pagination={{ pageSize: 5 }}
          columns={[
            { title: "Task", dataIndex: "title" },
            {
              title: "Worker",
              render: (_, row) => row.assigneeName || row.assigneeWorkerId || "-",
            },
            {
              title: "Proofs",
              render: (_, row) =>
                (row.proofs || []).length ? (
                  <Space wrap>
                    {row.proofs.map((p, i) => (
                      <Button
                        key={`${p.fileUrl}-${i}`}
                        size="small"
                        type="link"
                        href={buildFileUrl(p.fileUrl)}
                        target="_blank"
                      >
                        File {i + 1}
                      </Button>
                    ))}
                  </Space>
                ) : (
                  "-"
                ),
            },
            {
              title: "Action",
              render: (_, row) => (
                <Button size="small" type="primary" onClick={() => openReview(row)}>
                  Approve / Reject
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card title="All Tasks">
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={tasks}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: "max-content" }}
        />
      </Card>

      <Modal
        title="Assign Task"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onCreate}
        okText="Assign"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ priority: 3, expectedDurationMinutes: 60 }}>
          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: "Title is required" }]}
          >
            <Input placeholder="e.g. Install balustrade section A" />
          </Form.Item>
          <Form.Item label="Job" name="jobId">
            <Select allowClear showSearch optionFilterProp="children" placeholder="Optional linked job">
              {jobs.map((job) => (
                <Option key={job._id} value={job._id}>
                  {job.jobId} - {job.customer || "No customer"}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="Assign to employee"
            name="assigneeWorkerId"
            rules={[{ required: true, message: "Select the employee / worker" }]}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="children"
              placeholder="Select employee (syncs to worker My Tasks)"
              onChange={onAssigneePick}
            >
              {employees.map((emp) => (
                <Option key={emp._id || emp.employeeId} value={emp.employeeId || emp.workerId}>
                  {(emp.employeeId || emp.workerId || "-") + " - " + (emp.name || "")}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="assigneeName" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="assigneeEmail" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="Site zone" name="siteZone">
            <Input placeholder="Zone / floor / bay" />
          </Form.Item>
          <Form.Item label="Location" name="location">
            <Input placeholder="Site location notes" />
          </Form.Item>
          <Form.Item label="Priority (1=highest)" name="priority">
            <InputNumber min={1} max={5} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Expected duration (minutes)" name="expectedDurationMinutes">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item
            label="Checklist (one item per line)"
            name="checklistText"
          >
            <TextArea rows={4} placeholder={"PPE check\nTools ready\nPhotos attached"} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Review Task"
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onOk={onReview}
        okText="Submit Review"
        destroyOnClose
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item
            label="Decision"
            name="decision"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="approve">Approve</Option>
              <Option value="reject">Reject</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="Remarks"
            name="remarks"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue("decision") === "reject" && !String(value || "").trim()) {
                    return Promise.reject(new Error("Remarks required on reject"));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <TextArea rows={3} placeholder="Mandatory when rejecting" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
