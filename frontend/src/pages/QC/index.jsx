import { useEffect, useMemo, useState } from "react";
import {
  Table,
  Button,
  Select,
  Tag,
  Modal,
  Form,
  Input,
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
import dayjs from "dayjs";
import { useJob } from "../../context/JobContext";
import { getJobs, updateJob } from "../Jobs/jobApi";
import {
  getQcItems,
  createQcItem,
  updateQcItem,
  deleteQcItem,
} from "./qcApi";

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

const QC_STATUS_COLORS = {
  Pending: "default",
  Pass: "green",
  Fail: "red",
  Rework: "orange",
};

export default function QC() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeJobId, setActiveJobId } = useJob();

  const [jobs, setJobs] = useState([]);
  const [jobData, setJobData] = useState(null);

  const [items, setItems] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [completing, setCompleting] = useState(false);

  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  const queryJobId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("jobId");
  }, [location.search]);

  const jobId = queryJobId || activeJobId || localStorage.getItem("activeJobId");
  const jobKey = jobId ? `activeJobData_${jobId}` : null;

  const eligibleJobs = useMemo(() => {
    return Array.isArray(jobs)
      ? jobs.filter((job) => job?.workflowEvents?.fabrication?.isCompleted)
      : [];
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
      } catch { }
    }

    const allJobs = jobs.length ? jobs : await getJobs();
    const safeJobs = Array.isArray(allJobs) ? allJobs : [];
    const matched = safeJobs.find((j) => j._id === resolvedJobId) || null;

    if (matched) {
      setCurrentJobContext(matched);
      return matched;
    }

    return null;
  };

  const fetchItems = async (resolvedJobId) => {
    if (!resolvedJobId) {
      setItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      const data = await getQcItems(resolvedJobId);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to fetch QC items"
      );
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!jobId) {
        setJobData(null);
        setItems([]);
        return;
      }

      const job = await resolveJobData(jobId);

      if (!job) {
        message.warning("Please select a job first");
        return;
      }

      if (!job?.workflowEvents?.fabrication?.isCompleted) {
        message.warning("This job is not eligible for Quality Control.");
        setJobData(null);
        setItems([]);
        navigate("/admin/qc");
        return;
      }

      await fetchItems(jobId);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, location.state, jobs.length]);

  const onJobChange = (selectedJobId) => {
    if (!selectedJobId) {
      setJobData(null);
      setItems([]);
      localStorage.removeItem("activeJobId");
      navigate("/admin/qc");
      return;
    }

    const selectedJob = eligibleJobs.find((j) => j._id === selectedJobId);

    if (!selectedJob) {
      message.warning("Only QC-eligible jobs are allowed here");
      return;
    }

    setCurrentJobContext(selectedJob);

    navigate(`/admin/qc?jobId=${selectedJobId}`, {
      state: { job: selectedJob },
    });
  };

  const resetModal = () => {
    setOpen(false);
    setEditingItem(null);
    form.resetFields();
  };

  const openCreateModal = () => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      status: "Pending",
    });
    setOpen(true);
  };

  const openEditModal = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      itemName: record?.itemName || "",
      inspectionType: record?.inspectionType || "",
      checkedBy: record?.checkedBy || "",
      checkedDate: record?.checkedDate ? dayjs(record.checkedDate) : null,
      status: record?.status || "Pending",
      remarks: record?.remarks || "",
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
      itemName: values.itemName,
      inspectionType: values.inspectionType || "",
      checkedBy: values.checkedBy || "",
      checkedDate: values.checkedDate
        ? values.checkedDate.format("YYYY-MM-DD")
        : "",
      status: values.status || "Pending",
      remarks: values.remarks || "",
    };

    try {
      if (editingItem?._id) {
        await updateQcItem(editingItem._id, payload);
        message.success("QC item updated");
      } else {
        await createQcItem(payload);
        message.success("QC item added");
      }

      if (jobData) {
        const updatedJobData = {
          ...jobData,
          stage: "Quality Control",
          status: "Active",
        };
        setCurrentJobContext(updatedJobData);
      }

      await fetchItems(jobId);
      resetModal();
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to save QC item"
      );
    }
  };

  const updateStatus = async (record, newStatus) => {
    const oldStatus = record.status;

    setItems((prev) =>
      (Array.isArray(prev) ? prev : []).map((x) =>
        x._id === record._id ? { ...x, status: newStatus } : x
      )
    );

    try {
      await updateQcItem(record._id, { status: newStatus });
      await fetchItems(jobId);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Status update failed"
      );
      setItems((prev) =>
        (Array.isArray(prev) ? prev : []).map((x) =>
          x._id === record._id ? { ...x, status: oldStatus } : x
        )
      );
    }
  };

  const onDelete = async (record) => {
    try {
      await deleteQcItem(record._id);
      message.success("QC item deleted");
      await fetchItems(jobId);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Delete failed"
      );
    }
  };

  const completeQc = async () => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    if (!items.length) {
      message.warning("Add at least one QC item first");
      return;
    }

    const allPassed = items.every((item) => item.status === "Pass");

    if (!allPassed) {
      message.warning("All QC items must be marked as Pass first");
      return;
    }

    try {
      setCompleting(true);

      const finishingEvent = {
        ...(jobData?.workflowEvents?.finishing || {}),
        isCompleted: true,
        completedAt: new Date().toISOString(),
        completedBy: "QC Module",
      };

      await updateJob(jobId, {
        stage: "Installation",
        status: "Active",
        workflowEvents: {
          ...(jobData?.workflowEvents || {}),
          finishing: finishingEvent,
        },
      });

      if (jobData) {
        const updatedJobData = {
          ...jobData,
          stage: "Installation",
          status: "Active",
          workflowEvents: {
            ...(jobData?.workflowEvents || {}),
            finishing: finishingEvent,
          },
        };
        setCurrentJobContext(updatedJobData);
      }

      message.success("QC completed. Job moved to Installation.");
      navigate(`/admin/installation?jobId=${jobId}`, {
        state: {
          job: {
            ...jobData,
            stage: "Installation",
            status: "Active",
            workflowEvents: {
              ...(jobData?.workflowEvents || {}),
              finishing: finishingEvent,
            },
          },
        },
      });
    }
    catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to complete QC"
      );
    } finally {
      setCompleting(false);
    }
  };

  const columns = [
    {
      title: "Item",
      dataIndex: "itemName",
      width: 180,
    },
    {
      title: "Inspection Type",
      dataIndex: "inspectionType",
      width: 180,
      render: (v) => v || "-",
    },
    {
      title: "Checked By",
      dataIndex: "checkedBy",
      width: 150,
      render: (v) => v || "-",
    },
    {
      title: "Checked Date",
      dataIndex: "checkedDate",
      width: 130,
      render: (v) => v || "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 170,
      render: (_, record) => (
        <Select
          value={record.status}
          style={{ width: 160 }}
          onChange={(v) => updateStatus(record, v)}
        >
          <Option value="Pending">Pending</Option>
          <Option value="Pass">Pass</Option>
          <Option value="Fail">Fail</Option>
          <Option value="Rework">Rework</Option>
        </Select>
      ),
    },
    {
      title: "Tag",
      dataIndex: "status",
      width: 120,
      render: (status) => (
        <Tag color={QC_STATUS_COLORS[status] || "default"}>{status}</Tag>
      ),
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      width: 180,
      render: (v) => v || "-",
    },
    {
      title: "Actions",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEditModal(record)}>
            Edit
          </Button>
          <Popconfirm title="Delete this item?" onConfirm={() => onDelete(record)}>
            <Button danger size="small">
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const isEmpty = !loadingItems && items.length === 0;

  return (
    <div style={{ padding: 20 }}>
      <Space
        style={{
          width: "100%",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
        align="start"
        wrap
      >
        <div>
          <h2 style={{ margin: 0 }}>Quality Control</h2>
          <div style={{ color: "#666", marginTop: 4 }}>
            Only fabrication-completed jobs are available here.
          </div>
        </div>

        <Space wrap>
          <Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>
          <Button type="primary" onClick={openCreateModal}>
            + Add QC Item
          </Button>
          <Button type="primary" onClick={completeQc} loading={completing}>
            Mark QC Complete
          </Button>
        </Space>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12} lg={10}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              Search Eligible Job
            </div>
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
              {(eligibleJobs || []).map((job) => (
                <Option key={job._id} value={job._id}>
                  {job.jobId} - {job.customer || "No customer"}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} md={12} lg={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              Current Selection
            </div>
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
            <div style={{ marginBottom: 8, fontWeight: 500 }}>QC Status</div>
            {items.length > 0 ? (
              <Tag color="green">QC Items Available</Tag>
            ) : (
              <Tag color="orange">No QC Items</Tag>
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
              <Empty description="No QC items currently for this job." />
            </Card>
          ) : (
            <Table
              columns={columns}
              dataSource={items}
              rowKey="_id"
              loading={loadingItems}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1400 }}
            />
          )}
        </>
      )}

      <Modal
        title={editingItem ? "Edit QC Item" : "Add QC Item"}
        open={open}
        onCancel={resetModal}
        onOk={() => form.submit()}
        okText={editingItem ? "Update" : "Save"}
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item
            name="itemName"
            label="Item Name"
            rules={[{ required: true, message: "Item name is required" }]}
          >
            <Input placeholder="e.g. Glass Panel / Handrail / Bracket" />
          </Form.Item>

          <Form.Item name="inspectionType" label="Inspection Type">
            <Input placeholder="e.g. Dimension / Finish / Weld Check" />
          </Form.Item>

          <Form.Item name="checkedBy" label="Checked By">
            <Input placeholder="QC Inspector name" />
          </Form.Item>

          <Form.Item name="checkedDate" label="Checked Date">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="status" label="Status">
            <Select placeholder="Select status">
              <Option value="Pending">Pending</Option>
              <Option value="Pass">Pass</Option>
              <Option value="Fail">Fail</Option>
              <Option value="Rework">Rework</Option>
            </Select>
          </Form.Item>

          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={3} placeholder="Optional notes..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}