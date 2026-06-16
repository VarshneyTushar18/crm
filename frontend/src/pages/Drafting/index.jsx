import { useEffect, useMemo, useState } from "react";
import {
  Table,
  Button,
  Select,
  Tag,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Empty,
  Card,
  Descriptions,
  Spin,
  Row,
  Col,
  Switch,
} from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import { useJob } from "../../context/JobContext";
import { getJobs, updateJob } from "../Jobs/jobApi";
import {
  getDraftingRecords,
  createDraftingRecord,
  updateDraftingRecord,
  deleteDraftingRecord,
} from "./draftingApi";

const { Option } = Select;
const { TextArea } = Input;

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

const DRAFT_STATUS_COLORS = {
  Draft: "default",
  "Under Review": "blue",
  Approved: "green",
  Rejected: "red",
  "IFC Approved": "gold",
};

export default function Drafting() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeJobId, setActiveJobId } = useJob();

  const [jobs, setJobs] = useState([]);
  const [jobData, setJobData] = useState(null);

  const [records, setRecords] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [completing, setCompleting] = useState(false);

  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  const queryJobId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("jobId");
  }, [location.search]);

  const jobId = queryJobId || activeJobId || localStorage.getItem("activeJobId");
  const jobKey = jobId ? `activeJobData_${jobId}` : null;

  const eligibleJobs = useMemo(() => {
    return jobs.filter(
      (job) =>
        job?.workflowEvents?.clientApproval?.isCompleted ||
        String(job?.stage || "").toLowerCase() === "drafting"
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

  const fetchRecords = async (resolvedJobId) => {
    if (!resolvedJobId) {
      setRecords([]);
      return;
    }

    setLoadingRecords(true);
    try {
      const result = await getDraftingRecords(resolvedJobId);
      setRecords(Array.isArray(result) ? result : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to fetch drafting records"
      );
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!jobId) {
        setJobData(null);
        setRecords([]);
        return;
      }

      const job = await resolveJobData(jobId);

      if (!job) {
        message.warning("Please select a job first");
        return;
      }

      if (
        !job?.workflowEvents?.clientApproval?.isCompleted &&
        String(job?.stage || "").toLowerCase() !== "drafting"
      ) {
        message.warning(
          "This job is not eligible for Drafting. Complete Planning first."
        );
        setJobData(null);
        setRecords([]);
        navigate("/admin/drafting");
        return;
      }

      await fetchRecords(jobId);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, location.state, jobs.length]);

  const onJobChange = (selectedJobId) => {
    if (!selectedJobId) {
      setJobData(null);
      setRecords([]);
      localStorage.removeItem("activeJobId");
      navigate("/admin/drafting");
      return;
    }

    const selectedJob = eligibleJobs.find((j) => j._id === selectedJobId);

    if (!selectedJob) {
      message.warning("Only drafting-eligible jobs are allowed here");
      return;
    }

    setCurrentJobContext(selectedJob);

    navigate(`/admin/drafting?jobId=${selectedJobId}`, {
      state: { job: selectedJob },
    });
  };

  const resetModal = () => {
    setOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const openCreateModal = () => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      status: "Draft",
      isIFCApproved: false,
    });
    setOpen(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      title: record.title || "",
      drawingType: record.drawingType || "",
      revision: record.revision || "",
      status: record.status || "Draft",
      preparedBy: record.preparedBy || "",
      checkedBy: record.checkedBy || "",
      approvedBy: record.approvedBy || "",
      remarks: record.remarks || "",
      fileUrl: record.fileUrl || "",
      isIFCApproved: !!record.isIFCApproved,
    });
    setOpen(true);
  };

  const onSubmit = async (values) => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    const payload = {
      jobId,
      title: values.title,
      drawingType: values.drawingType,
      revision: values.revision,
      status: values.status,
      preparedBy: values.preparedBy,
      checkedBy: values.checkedBy,
      approvedBy: values.approvedBy,
      remarks: values.remarks,
      fileUrl: values.fileUrl,
      isIFCApproved: !!values.isIFCApproved,
    };

    try {
      if (editingRecord?._id) {
        await updateDraftingRecord(editingRecord._id, payload);
        message.success("Drafting record updated");
      } else {
        await createDraftingRecord(payload);
        message.success("Drafting record added");
      }

      await fetchRecords(jobId);
      resetModal();
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to save drafting record"
      );
    }
  };

  const onDelete = async (record) => {
    try {
      await deleteDraftingRecord(record._id);
      message.success("Drafting record deleted");
      await fetchRecords(jobId);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Delete failed"
      );
    }
  };

  const markIFCApproved = async (record) => {
    try {
      await updateDraftingRecord(record._id, {
        status: "IFC Approved",
        isIFCApproved: true,
      });

      message.success("Drawing marked as IFC Approved. Fabrication can now proceed.");
      await fetchRecords(jobId);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to mark IFC approved"
      );
    }
  };

  const completeDrafting = async () => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    const hasIFCApproved = records.some(
      (item) => item.status === "IFC Approved" || item.isIFCApproved
    );

    if (!hasIFCApproved) {
      message.warning("Please mark at least one drawing as IFC Approved first");
      return;
    }

    try {
      setCompleting(true);

      // Mark drafting lifestyle status to completed, then move to job scheduling
      const draftingEvent = {
        ...(jobData?.workflowEvents?.drafting || {}),
        isCompleted: true,
        completedAt: new Date().toISOString(),
        completedBy: "Drafting Module",
      };

      await updateJob(jobId, {
        stage: "Material Purchase",
        status: "Active",
        workflowEvents: {
          ...jobData?.workflowEvents,
          drafting: draftingEvent,
        },
      });

      if (jobData) {
        const updatedJobData = {
          ...jobData,
          stage: "Material Purchase",
          status: "Active",
          workflowEvents: {
            ...jobData.workflowEvents,
            drafting: draftingEvent,
          },
        };
        setCurrentJobContext(updatedJobData);
      }

      message.success("Drafting completed. Job moved to Material Purchasing.");
      navigate("/admin/jobs");
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to complete drafting"
      );
    } finally {
      setCompleting(false);
    }
  };

  const columns = [
    { title: "Title", dataIndex: "title" },
    { title: "Type", dataIndex: "drawingType" },
    { title: "Revision", dataIndex: "revision" },
    { title: "Prepared By", dataIndex: "preparedBy" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status) => (
        <Tag color={DRAFT_STATUS_COLORS[status] || "default"}>
          {status || "-"}
        </Tag>
      ),
    },
    {
      title: "IFC",
      render: (_, record) =>
        record.isIFCApproved || record.status === "IFC Approved" ? (
          <Tag color="gold">IFC Approved</Tag>
        ) : (
          <Tag>Not Approved</Tag>
        ),
    },
    {
      title: "File",
      render: (_, record) =>
        record.fileUrl ? (
          <a href={record.fileUrl} target="_blank" rel="noreferrer">
            Open File
          </a>
        ) : (
          "-"
        ),
    },
    {
      title: "Actions",
      render: (_, record) => (
        <Space wrap>
          <Button size="small" onClick={() => openEditModal(record)}>
            Edit
          </Button>

          <Button
            size="small"
            type="primary"
            disabled={record.isIFCApproved || record.status === "IFC Approved"}
            onClick={() => markIFCApproved(record)}
          >
            Mark IFC Approved
          </Button>

          <Popconfirm title="Delete this drafting record?" onConfirm={() => onDelete(record)}>
            <Button danger size="small">
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const isEmpty = !loadingRecords && records.length === 0;

  return (
    <div style={{ padding: 20 }}>
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
        align="start"
        wrap
      >
        <div>
          <h2 style={{ margin: 0 }}>Drafting</h2>
          <div style={{ color: "#666", marginTop: 4 }}>
            Only Planning completed jobs are available here.
          </div>
        </div>

        <Space wrap>
          <Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>
          <Button type="primary" onClick={openCreateModal}>
            + Add Draft
          </Button>
          <Button type="primary" onClick={completeDrafting} loading={completing}>
            Complete Drafting
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
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Drafting Status</div>
            {records.length > 0 ? (
              <Tag color="green">Drafting Records Available</Tag>
            ) : (
              <Tag color="orange">No Drafting Records</Tag>
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
              <Empty description="No drafting records currently for this job." />
            </Card>
          ) : (
            <Table
              columns={columns}
              dataSource={records}
              rowKey="_id"
              loading={loadingRecords}
              pagination={{ pageSize: 10 }}
            />
          )}
        </>
      )}

      <Modal
        title={editingRecord ? "Edit Drafting Record" : "Add Drafting Record"}
        open={open}
        onCancel={resetModal}
        onOk={() => form.submit()}
        okText={editingRecord ? "Update" : "Save"}
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item
            name="title"
            label="Drawing Title"
            rules={[{ required: true, message: "Drawing title is required" }]}
          >
            <Input placeholder="e.g. Balcony Glass Layout" />
          </Form.Item>

          <Form.Item
            name="drawingType"
            label="Drawing Type"
            rules={[{ required: true, message: "Drawing type is required" }]}
          >
            <Select placeholder="Select drawing type">
              <Option value="Shop Drawing">Shop Drawing</Option>
              <Option value="IFC Drawing">IFC Drawing</Option>
              <Option value="Detail Drawing">Detail Drawing</Option>
              <Option value="As-Built Drawing">As-Built Drawing</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="revision"
            label="Revision"
            rules={[{ required: true, message: "Revision is required" }]}
          >
            <Input placeholder="e.g. Rev-0 / Rev-1 / IFC" />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: "Status is required" }]}
          >
            <Select placeholder="Select status">
              <Option value="Draft">Draft</Option>
              <Option value="Under Review">Under Review</Option>
              <Option value="Approved">Approved</Option>
              <Option value="Rejected">Rejected</Option>
              <Option value="IFC Approved">IFC Approved</Option>
            </Select>
          </Form.Item>

          <Form.Item name="preparedBy" label="Prepared By">
            <Input placeholder="Drafting engineer / designer" />
          </Form.Item>

          <Form.Item name="checkedBy" label="Checked By">
            <Input placeholder="Checker name" />
          </Form.Item>

          <Form.Item name="approvedBy" label="Approved By">
            <Input placeholder="Approver name" />
          </Form.Item>

          <Form.Item name="fileUrl" label="File URL">
            <Input placeholder="PDF / DWG / Drive link" />
          </Form.Item>

          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={3} placeholder="Notes / revision comments" />
          </Form.Item>

          <Form.Item
            name="isIFCApproved"
            label="IFC Approved"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}