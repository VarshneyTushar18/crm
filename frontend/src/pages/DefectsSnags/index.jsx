import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Image,
  Input,
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
import {
  CheckCircleOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import { useJob } from "@/context/JobContext";
import { buildFileUrl } from "@/config/serverApiConfig";
import { getJobs } from "../Jobs/jobApi";
import { getEmployees } from "../Employee/employeeApi";
import {
  closeDefectSnag,
  createDefectSnag,
  getDefectSnags,
  updateDefectSnag,
  uploadDefectSnagFiles,
} from "./defectSnagApi";

const { Option } = Select;
const { TextArea } = Input;

const STATUS_COLORS = {
  Open: "gold",
  "In Progress": "blue",
  Closed: "green",
};

const TYPE_COLORS = {
  Defect: "red",
  Snag: "orange",
};

const DefectsSnags = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeJobId, setActiveJobId } = useJob();

  const [jobs, setJobs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("list");

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [clearing, setClearing] = useState(null);
  const [addFileList, setAddFileList] = useState([]);

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [clearForm] = Form.useForm();

  const selectedJobId = activeJobId || "";
  const selectedJob = useMemo(
    () => jobs.find((j) => j._id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  const openItems = useMemo(
    () => items.filter((i) => i.status === "Open" || i.status === "In Progress"),
    [items]
  );

  const loadJobs = useCallback(async () => {
    try {
      const data = await getJobs();
      const list = Array.isArray(data) ? data : data?.result || [];
      setJobs(list);
    } catch (err) {
      message.error("Failed to load jobs");
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      setEmployees(Array.isArray(data) ? data : data?.result || []);
    } catch {
      setEmployees([]);
    }
  }, []);

  const loadItems = useCallback(async (jobId) => {
    if (!jobId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getDefectSnags(jobId);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || "Failed to load defects & snags"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    loadEmployees();
  }, [loadJobs, loadEmployees]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const jobFromUrl = params.get("jobId");
    if (jobFromUrl && jobFromUrl !== activeJobId) {
      setActiveJobId(jobFromUrl);
    }
  }, [location.search, activeJobId, setActiveJobId]);

  useEffect(() => {
    if (selectedJobId) loadItems(selectedJobId);
  }, [selectedJobId, loadItems]);

  const onJobChange = (jobId) => {
    setActiveJobId(jobId || "");
    const params = new URLSearchParams(location.search);
    if (jobId) params.set("jobId", jobId);
    else params.delete("jobId");
    navigate({ search: params.toString() }, { replace: true });
  };

  const openAdd = () => {
    if (!selectedJobId) {
      message.warning("Select a job first");
      return;
    }
    addForm.resetFields();
    addForm.setFieldsValue({
      type: "Snag",
      status: "Open",
      dueDate: null,
    });
    setAddFileList([]);
    setAddOpen(true);
  };

  const submitAdd = async (values) => {
    setSaving(true);
    try {
      const created = await createDefectSnag({
        jobId: selectedJobId,
        type: values.type,
        title: values.title,
        description: values.description || "",
        locationArea: values.locationArea || "",
        owner: values.owner || "",
        dueDate: values.dueDate ? values.dueDate.format("YYYY-MM-DD") : "",
        status: values.status || "Open",
        source: "manual",
      });

      const files = (addFileList || [])
        .map((f) => f.originFileObj)
        .filter(Boolean);

      if (created?._id && files.length) {
        try {
          await uploadDefectSnagFiles(created._id, files, "evidence");
        } catch (uploadErr) {
          message.warning(
            uploadErr?.response?.data?.message ||
              "Defect / snag saved, but photo upload failed — edit to retry"
          );
        }
      }

      message.success("Defect / snag added");
      setAddOpen(false);
      setAddFileList([]);
      await loadItems(selectedJobId);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (record) => {
    setEditing(record);
    editForm.setFieldsValue({
      type: record.type || "Snag",
      title: record.title,
      description: record.description || "",
      locationArea: record.locationArea || "",
      owner: record.owner || undefined,
      dueDate: record.dueDate ? dayjs(record.dueDate) : null,
      status: record.status === "Closed" ? "Open" : record.status,
    });
    setEditOpen(true);
  };

  const submitEdit = async (values) => {
    if (!editing?._id) return;
    setSaving(true);
    try {
      await updateDefectSnag(editing._id, {
        type: values.type,
        title: values.title,
        description: values.description || "",
        locationArea: values.locationArea || "",
        owner: values.owner || "",
        dueDate: values.dueDate ? values.dueDate.format("YYYY-MM-DD") : "",
        status: values.status,
      });
      message.success("Updated");
      setEditOpen(false);
      setEditing(null);
      await loadItems(selectedJobId);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const openClear = (record) => {
    setClearing(record);
    clearForm.resetFields();
    clearForm.setFieldsValue({ closedBy: undefined, closeOutNotes: "" });
    setClearOpen(true);
  };

  const submitClear = async (values) => {
    if (!clearing?._id) return;
    setSaving(true);
    try {
      await closeDefectSnag(clearing._id, {
        closedBy: values.closedBy || "",
        closeOutNotes: values.closeOutNotes,
      });
      message.success("Cleared — status set to Closed");
      setClearOpen(false);
      setClearing(null);
      await loadItems(selectedJobId);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to clear");
    } finally {
      setSaving(false);
    }
  };

  const photoCell = (urls = []) => {
    if (!urls?.length) return "—";
    return (
      <Image.PreviewGroup>
        <Space wrap size={4}>
          {urls.slice(0, 3).map((url) => (
            <Image
              key={url}
              src={buildFileUrl(url)}
              width={40}
              height={40}
              style={{ objectFit: "cover", borderRadius: 4 }}
            />
          ))}
          {urls.length > 3 ? <Tag>+{urls.length - 3}</Tag> : null}
        </Space>
      </Image.PreviewGroup>
    );
  };

  const listColumns = [
    {
      title: "Type",
      dataIndex: "type",
      width: 100,
      render: (t) => <Tag color={TYPE_COLORS[t] || "default"}>{t}</Tag>,
    },
    { title: "Title", dataIndex: "title", ellipsis: true },
    {
      title: "Owner",
      dataIndex: "owner",
      width: 160,
      render: (v) => v || "—",
    },
    {
      title: "Photos",
      dataIndex: "photoUrls",
      width: 140,
      render: photoCell,
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      width: 120,
      render: (v) => (v ? dayjs(v).format("DD-MM-YYYY") : "—"),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (s) => <Tag color={STATUS_COLORS[s] || "default"}>{s}</Tag>,
    },
    {
      title: "Source",
      dataIndex: "source",
      width: 110,
      render: (s) => (s === "installation" ? "Installation" : "Manual"),
    },
    {
      title: "Close-out",
      key: "closeout",
      width: 200,
      render: (_, row) => {
        if (row.status !== "Closed") return "—";
        return (
          <Space direction="vertical" size={0}>
            <span>{row.closedBy || "—"}</span>
            <span style={{ color: "#888", fontSize: 12 }}>
              {row.closedAt ? dayjs(row.closedAt).format("DD-MM-YYYY") : ""}
            </span>
            {row.closeOutNotes ? (
              <span style={{ fontSize: 12 }}>{row.closeOutNotes}</span>
            ) : null}
            {photoCell(row.closeOutPhotoUrls)}
          </Space>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      render: (_, row) =>
        row.status === "Closed" ? (
          "—"
        ) : (
          <Space>
            <Button size="small" onClick={() => openEdit(row)}>
              Edit
            </Button>
          </Space>
        ),
    },
  ];

  const clearColumns = [
    {
      title: "Type",
      dataIndex: "type",
      width: 100,
      render: (t) => <Tag color={TYPE_COLORS[t] || "default"}>{t}</Tag>,
    },
    { title: "Title", dataIndex: "title", ellipsis: true },
    {
      title: "Owner",
      dataIndex: "owner",
      width: 160,
      render: (v) => v || "—",
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      width: 120,
      render: (v) => (v ? dayjs(v).format("DD-MM-YYYY") : "—"),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (s) => <Tag color={STATUS_COLORS[s] || "default"}>{s}</Tag>,
    },
    {
      title: "Photos",
      dataIndex: "photoUrls",
      width: 140,
      render: photoCell,
    },
    {
      title: "Close-out",
      key: "closeout",
      width: 140,
      render: (_, row) => (
        <Button
          type="primary"
          size="small"
          icon={<CheckCircleOutlined />}
          onClick={() => openClear(row)}
        >
          Clear
        </Button>
      ),
    },
  ];

  const formFields = (allowStatus = true) => (
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <Form.Item
          name="type"
          label="Type"
          rules={[{ required: true, message: "Select type" }]}
        >
          <Select>
            <Option value="Defect">Defect</Option>
            <Option value="Snag">Snag</Option>
          </Select>
        </Form.Item>
      </Col>
      <Col xs={24} md={16}>
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: "Title is required" }]}
        >
          <Input placeholder="Short description of the issue" />
        </Form.Item>
      </Col>
      <Col xs={24}>
        <Form.Item name="description" label="Description">
          <TextArea rows={3} placeholder="Details" />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="locationArea" label="Location / Area">
          <Input placeholder="e.g. Level 2 handrail" />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="owner" label="Owner">
          <Select
            allowClear
            showSearch
            placeholder="Assign owner"
            optionFilterProp="children"
          >
            {employees.map((emp) => (
              <Option key={emp._id} value={emp.name}>
                {emp.name}
                {emp.employeeId ? ` (${emp.employeeId})` : ""}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="dueDate" label="Due Date">
          <DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
        </Form.Item>
      </Col>
      {allowStatus ? (
        <Col xs={24} md={12}>
          <Form.Item name="status" label="Status">
            <Select>
              <Option value="Open">Open</Option>
              <Option value="In Progress">In Progress</Option>
            </Select>
          </Form.Item>
        </Col>
      ) : null}
    </Row>
  );

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="Defects & Snags"
        extra={
          <Space wrap>
            <Select
              showSearch
              allowClear
              placeholder="Select job"
              style={{ minWidth: 260 }}
              value={selectedJobId || undefined}
              onChange={onJobChange}
              optionFilterProp="children"
            >
              {jobs.map((job) => (
                <Option key={job._id} value={job._id}>
                  {job.jobId || job.jobNumber || job._id}
                  {job.customer?.name ? ` — ${job.customer.name}` : ""}
                </Option>
              ))}
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              Add Defect / Snag
            </Button>
          </Space>
        }
      >
        {!selectedJobId ? (
          <Empty description="Select a job to view defects & snags" />
        ) : (
          <>
            <Space style={{ marginBottom: 12 }} wrap>
              <Tag>
                Job: {selectedJob?.jobId || selectedJob?.jobNumber || selectedJobId}
              </Tag>
              <Tag color={openItems.length ? "red" : "green"}>
                Open: {openItems.length}
              </Tag>
              <Tag>
                Total: {items.length}
              </Tag>
            </Space>

            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: "list",
                  label: "List",
                  children: (
                    <Table
                      rowKey="_id"
                      loading={loading}
                      dataSource={items}
                      columns={listColumns}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 1000 }}
                      locale={{
                        emptyText: (
                          <Empty description="No defects or snags for this job" />
                        ),
                      }}
                    />
                  ),
                },
                {
                  key: "clearing",
                  label: `Clearing (${openItems.length})`,
                  children: (
                    <Table
                      rowKey="_id"
                      loading={loading}
                      dataSource={openItems}
                      columns={clearColumns}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 900 }}
                      locale={{
                        emptyText: (
                          <Empty description="Nothing to clear — all closed or none raised" />
                        ),
                      }}
                    />
                  ),
                },
              ]}
            />
          </>
        )}
      </Card>

      <Modal
        title="Add Defect / Snag"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false);
          setAddFileList([]);
        }}
        onOk={() => addForm.submit()}
        confirmLoading={saving}
        destroyOnClose
        width={720}
      >
        <Form form={addForm} layout="vertical" onFinish={submitAdd}>
          {formFields(true)}
          <Form.Item label="Photos">
            <Upload
              multiple
              accept="image/*,.pdf"
              listType="picture"
              fileList={addFileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setAddFileList(fileList)}
            >
              <Button icon={<UploadOutlined />}>Add photos</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Edit Defect / Snag"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        onOk={() => editForm.submit()}
        confirmLoading={saving}
        destroyOnClose
        width={720}
      >
        <Form form={editForm} layout="vertical" onFinish={submitEdit}>
          {formFields(true)}
        </Form>
        {editing?._id ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Photos</div>
            {photoCell(editing.photoUrls)}
            <Upload
              multiple
              accept="image/*,.pdf"
              showUploadList={false}
              customRequest={async ({ file, onSuccess, onError }) => {
                try {
                  const updated = await uploadDefectSnagFiles(
                    editing._id,
                    [file],
                    "evidence"
                  );
                  setEditing(updated);
                  message.success("Photo uploaded");
                  await loadItems(selectedJobId);
                  onSuccess?.(null, file);
                } catch (err) {
                  message.error(err?.response?.data?.message || "Upload failed");
                  onError?.(err);
                }
              }}
            >
              <Button icon={<UploadOutlined />} style={{ marginTop: 8 }}>
                Upload photos
              </Button>
            </Upload>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={
          clearing
            ? `Clear: ${clearing.title}`
            : "Clear Defect / Snag"
        }
        open={clearOpen}
        onCancel={() => {
          setClearOpen(false);
          setClearing(null);
        }}
        onOk={() => clearForm.submit()}
        okText="Mark Closed"
        confirmLoading={saving}
        destroyOnClose
        width={640}
      >
        <Form form={clearForm} layout="vertical" onFinish={submitClear}>
          <Form.Item name="closedBy" label="Closed By">
            <Select
              allowClear
              showSearch
              placeholder="Who cleared this"
              optionFilterProp="children"
            >
              {employees.map((emp) => (
                <Option key={emp._id} value={emp.name}>
                  {emp.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="closeOutNotes"
            label="Close-out Notes"
            rules={[{ required: true, message: "Close-out notes are required" }]}
          >
            <TextArea rows={4} placeholder="What was fixed / how it was cleared" />
          </Form.Item>
        </Form>
        {clearing?._id ? (
          <Upload
            multiple
            accept="image/*,.pdf"
            showUploadList={false}
            customRequest={async ({ file, onSuccess, onError }) => {
              try {
                const updated = await uploadDefectSnagFiles(
                  clearing._id,
                  [file],
                  "closeout"
                );
                setClearing(updated);
                message.success("Close-out photo uploaded");
                onSuccess?.(null, file);
              } catch (err) {
                message.error(err?.response?.data?.message || "Upload failed");
                onError?.(err);
              }
            }}
          >
            <Button icon={<UploadOutlined />}>Upload proof photos</Button>
          </Upload>
        ) : null}
        {clearing?.closeOutPhotoUrls?.length ? (
          <div style={{ marginTop: 12 }}>{photoCell(clearing.closeOutPhotoUrls)}</div>
        ) : null}
      </Modal>
    </div>
  );
};

export default DefectsSnags;
