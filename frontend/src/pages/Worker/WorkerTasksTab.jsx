import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { buildFileUrl } from "@/config/serverApiConfig";
import {
  completeWorkerTask,
  getMyWorkerTasks,
  startWorkerTask,
  uploadWorkerTaskProof,
} from "@/api/workerTaskApi";

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLORS = {
  Assigned: "blue",
  "In Progress": "processing",
  Submitted: "gold",
  Completed: "green",
  Rejected: "red",
  Cancelled: "default",
};

const captureGps = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve({ latitude: null, longitude: null }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

export default function WorkerTasksTab() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [proofFiles, setProofFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const openCount = useMemo(
    () =>
      tasks.filter((t) =>
        ["Assigned", "In Progress", "Rejected"].includes(t.status)
      ).length,
    [tasks]
  );

  const load = async () => {
    setLoading(true);
    try {
      const list = await getMyWorkerTasks();
      setTasks(Array.isArray(list) ? list : []);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = setInterval(load, 20000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const onStart = async (task) => {
    try {
      const gps = await captureGps();
      await startWorkerTask(task._id, gps);
      message.success("Task started");
      window.dispatchEvent(new Event("worker-task-changed"));
      await load();
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to start task");
    }
  };

  const openComplete = (task) => {
    setSelected(task);
    setProofFiles([]);
    form.setFieldsValue({
      remarks: task.remarks || "",
      checklist: (task.checklist || []).map((item) => ({
        label: item.label,
        done: !!item.done,
      })),
    });
    setCompleteOpen(true);
  };

  const onComplete = async () => {
    if (!selected?._id) return;
    try {
      setSaving(true);
      const values = await form.validateFields();
      if (proofFiles.length) {
        await uploadWorkerTaskProof(selected._id, proofFiles);
      }
      const gps = await captureGps();
      await completeWorkerTask(selected._id, {
        remarks: values.remarks || "",
        checklist: values.checklist || [],
        ...gps,
      });
      message.success("Task submitted for site engineer review");
      setCompleteOpen(false);
      setSelected(null);
      window.dispatchEvent(new Event("worker-task-changed"));
      await load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || "Failed to complete task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>
            My Tasks
          </Title>
          <Text type="secondary">{openCount} open task(s)</Text>
        </div>
        <Button onClick={load} loading={loading}>
          Refresh
        </Button>
      </Space>

      {!loading && !tasks.length ? (
        <Empty description="No tasks assigned yet" />
      ) : (
        <Row gutter={[12, 12]}>
          {tasks.map((task) => (
            <Col xs={24} md={12} key={task._id}>
              <Card size="small" title={task.title}>
                <Space direction="vertical" style={{ width: "100%" }} size={6}>
                  <Tag color={STATUS_COLORS[task.status] || "default"}>
                    {task.status}
                  </Tag>
                  {task.reviewStatus && task.reviewStatus !== "None" ? (
                    <Tag>{task.reviewStatus}</Tag>
                  ) : null}
                  <Text type="secondary">
                    Priority P{task.priority || 3}
                    {task.status === "In Progress" && task.startedAt
                      ? ` · running since ${new Date(task.startedAt).toLocaleTimeString()}`
                      : ` · planned ${task.expectedDurationMinutes || 0} min`}
                  </Text>
                  <Text>
                    {task.siteZone || task.location || "No zone/location"}
                  </Text>
                  {task.jobId?.jobId ? (
                    <Text type="secondary">Job: {task.jobId.jobId}</Text>
                  ) : null}
                  {task.description ? <Text>{task.description}</Text> : null}
                  {task.reviewRemarks ? (
                    <Text type="danger">Review: {task.reviewRemarks}</Text>
                  ) : null}
                  <Space wrap>
                    {["Assigned", "Rejected"].includes(task.status) ? (
                      <Button type="primary" onClick={() => onStart(task)}>
                        Start Task
                      </Button>
                    ) : null}
                    {["In Progress", "Assigned", "Rejected"].includes(task.status) ? (
                      <Button onClick={() => openComplete(task)}>
                        Complete / Submit
                      </Button>
                    ) : null}
                  </Space>
                  {(task.proofs || []).length ? (
                    <Space wrap>
                      {task.proofs.map((proof, idx) => (
                        <Button
                          key={`${proof.fileUrl}-${idx}`}
                          size="small"
                          type="link"
                          href={buildFileUrl(proof.fileUrl)}
                          target="_blank"
                        >
                          Proof {idx + 1}
                        </Button>
                      ))}
                    </Space>
                  ) : null}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="Submit task proof"
        open={completeOpen}
        onCancel={() => setCompleteOpen(false)}
        onOk={onComplete}
        confirmLoading={saving}
        okText="Submit for Review"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Checklist" name="checklist">
            <Form.List name="checklist">
              {(fields) => (
                <Space direction="vertical" style={{ width: "100%" }}>
                  {fields.map((field) => (
                    <Space key={field.key} align="start">
                      <Form.Item
                        {...field}
                        name={[field.name, "done"]}
                        valuePropName="checked"
                        style={{ marginBottom: 0 }}
                      >
                        <Checkbox />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "label"]}
                        style={{ marginBottom: 0, minWidth: 220 }}
                      >
                        <Input disabled />
                      </Form.Item>
                    </Space>
                  ))}
                  {!fields.length ? (
                    <Text type="secondary">No checklist items</Text>
                  ) : null}
                </Space>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item label="Remarks" name="remarks">
            <TextArea rows={3} placeholder="Work notes / handover remarks" />
          </Form.Item>
          <Form.Item label="Proof of work (photos / video)">
            <Upload
              multiple
              beforeUpload={(file) => {
                setProofFiles((prev) => [...prev, file]);
                return false;
              }}
              onRemove={(file) => {
                setProofFiles((prev) =>
                  prev.filter((item) => item.uid !== file.uid)
                );
              }}
              fileList={proofFiles}
            >
              <Button icon={<UploadOutlined />}>Upload proof</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
