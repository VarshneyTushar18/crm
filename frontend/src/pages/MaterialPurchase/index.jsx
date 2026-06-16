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
import dayjs from "dayjs";
import { useJob } from "../../context/JobContext";
import { getJobs, updateJob } from "../Jobs/jobApi";
import {
  getMaterialItems,
  createMaterialItem,
  updateMaterialItem,
  deleteMaterialItem,
} from "./materialPurchaseApi";

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

const ITEM_STATUS_COLORS = {
  Pending: "default",
  Ordered: "blue",
  "Partially Received": "orange",
  Received: "green",
  Cancelled: "red",
};

export default function MaterialPurchase() {
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
    return jobs.filter((job) => job?.workflowEvents?.clientApproval?.isCompleted);
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

  const fetchItems = async (resolvedJobId) => {
    if (!resolvedJobId) {
      setItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      const data = await getMaterialItems(resolvedJobId);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to fetch material items"
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

      if (!job?.workflowEvents?.drafting?.isCompleted) {
        message.warning(
          "This job is not eligible for Material Purchase."
        );
        setJobData(null);
        setItems([]);
        navigate("/admin/material-purchase");
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
      navigate("/admin/material-purchase");
      return;
    }

    const selectedJob = eligibleJobs.find((j) => j._id === selectedJobId);

    if (!selectedJob) {
      message.warning("Only material-purchase eligible jobs are allowed here");
      return;
    }

    setCurrentJobContext(selectedJob);

    navigate(`/admin/material-purchase?jobId=${selectedJobId}`, {
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
      unit: "Nos",
    });
    setOpen(true);
  };

  const openEditModal = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      itemName: record.itemName || "",
      category: record.category || "",
      specification: record.specification || "",
      unit: record.unit || "",
      requiredQty: record.requiredQty ?? 0,
      orderedQty: record.orderedQty ?? 0,
      receivedQty: record.receivedQty ?? 0,
      supplier: record.supplier || "",
      expectedDelivery: record.expectedDelivery
        ? dayjs(record.expectedDelivery)
        : null,
      status: record.status || "Pending",
      remarks: record.remarks || "",
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
      category: values.category || "",
      specification: values.specification || "",
      unit: values.unit || "",
      requiredQty: Number(values.requiredQty || 0),
      orderedQty: Number(values.orderedQty || 0),
      receivedQty: Number(values.receivedQty || 0),
      supplier: values.supplier || "",
      expectedDelivery: values.expectedDelivery
        ? values.expectedDelivery.format("YYYY-MM-DD")
        : "",
      status: values.status || "Pending",
      remarks: values.remarks || "",
    };

    try {
      if (editingItem?._id) {
        await updateMaterialItem(editingItem._id, payload);
        message.success("Material item updated");
      } else {
        await createMaterialItem(payload);
        message.success("Material item added");
      }

      if (jobData) {
        const updatedJobData = {
          ...jobData,
          stage: "materialPurchasing",
          status: "Active",
        };
        setCurrentJobContext(updatedJobData);
      }

      await fetchItems(jobId);
      resetModal();
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to save material item"
      );
    }
  };

  const updateStatus = async (record, newStatus) => {
    const oldStatus = record.status;

    setItems((prev) =>
      prev.map((x) => (x._id === record._id ? { ...x, status: newStatus } : x))
    );

    try {
      await updateMaterialItem(record._id, { status: newStatus });
      await fetchItems(jobId);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Status update failed"
      );
      setItems((prev) =>
        prev.map((x) => (x._id === record._id ? { ...x, status: oldStatus } : x))
      );
    }
  };

  const onDelete = async (record) => {
    try {
      await deleteMaterialItem(record._id);
      message.success("Material item deleted");
      await fetchItems(jobId);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Delete failed"
      );
    }
  };

  const completeMaterialPurchase = async () => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    if (!items.length) {
      message.warning("Add at least one material item first");
      return;
    }

    const allReceived = items.every((item) => item.status === "Received");

    if (!allReceived) {
      message.warning("All material items must be marked as Received first");
      return;
    }

    try {
      setCompleting(true);

      const materialPurchaseEvent = {
        ...(jobData?.workflowEvents?.materialPurchasing || {}),
        isCompleted: true,
        completedAt: new Date().toISOString(),
        completedBy: "Material Purchase Module",
      };

      await updateJob(jobId, {
        stage: "Fabrication",
        status: "Active",
        workflowEvents: {
          ...jobData?.workflowEvents,
          materialPurchasing: materialPurchaseEvent,
        },
      });

      if (jobData) {
        const updatedJobData = {
          ...jobData,
          stage: "Fabrication",
          status: "Active",
          workflowEvents: {
            ...jobData.workflowEvents,
            materialPurchasing: materialPurchaseEvent,
          },
        };
        setCurrentJobContext(updatedJobData);
      }

      message.success("Material Purchase completed. Job moved to Fabrication.");
      navigate("/admin/jobs");
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to complete material purchase"
      );
    } finally {
      setCompleting(false);
    }
  };

  const tableData = items.map((item) => ({
    ...item,
    balanceQty: Number(item.requiredQty || 0) - Number(item.receivedQty || 0),
  }));

  const columns = [
    {
      title: "Item",
      dataIndex: "itemName",
      width: 160,
    },
    {
      title: "Category",
      dataIndex: "category",
      width: 120,
      render: (v) => v || "-",
    },
    {
      title: "Specification",
      dataIndex: "specification",
      width: 180,
      render: (v) => v || "-",
    },
    {
      title: "Unit",
      dataIndex: "unit",
      width: 80,
      render: (v) => v || "-",
    },
    {
      title: "Required",
      dataIndex: "requiredQty",
      width: 90,
    },
    {
      title: "Ordered",
      dataIndex: "orderedQty",
      width: 90,
    },
    {
      title: "Received",
      dataIndex: "receivedQty",
      width: 90,
    },
    {
      title: "Balance",
      dataIndex: "balanceQty",
      width: 90,
    },
    {
      title: "Supplier",
      dataIndex: "supplier",
      width: 150,
      render: (v) => v || "-",
    },
    {
      title: "Expected Delivery",
      dataIndex: "expectedDelivery",
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
          <Option value="Ordered">Ordered</Option>
          <Option value="Partially Received">Partially Received</Option>
          <Option value="Received">Received</Option>
          <Option value="Cancelled">Cancelled</Option>
        </Select>
      ),
    },
    {
      title: "Tag",
      dataIndex: "status",
      width: 150,
      render: (status) => (
        <Tag color={ITEM_STATUS_COLORS[status] || "default"}>{status}</Tag>
      ),
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
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
        align="start"
        wrap
      >
        <div>
          <h2 style={{ margin: 0 }}>Material Purchase</h2>
          <div style={{ color: "#666", marginTop: 4 }}>
            Only jobs with completed Drafting are available here.
          </div>
        </div>

        <Space wrap>
          <Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>
          <Button type="primary" onClick={openCreateModal}>
            + Add Item
          </Button>
          <Button type="primary" onClick={completeMaterialPurchase} loading={completing}>
            Mark Material Complete
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
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Material Status</div>
            {items.length > 0 ? (
              <Tag color="green">Material Items Available</Tag>
            ) : (
              <Tag color="orange">No Material Items</Tag>
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
              <Empty description="No material items currently for this job." />
            </Card>
          ) : (
            <Table
              columns={columns}
              dataSource={tableData}
              rowKey="_id"
              loading={loadingItems}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1700 }}
            />
          )}
        </>
      )}

      <Modal
        title={editingItem ? "Edit Material Item" : "Add Material Item"}
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
            <Input placeholder="e.g. Glass Panel" />
          </Form.Item>

          <Form.Item name="category" label="Category">
            <Input placeholder="e.g. Glass / Hardware / SS" />
          </Form.Item>

          <Form.Item name="specification" label="Specification">
            <Input placeholder="e.g. 12mm toughened glass" />
          </Form.Item>

          <Form.Item name="unit" label="Unit">
            <Select placeholder="Select unit">
              <Option value="Nos">Nos</Option>
              <Option value="Meter">Meter</Option>
              <Option value="Sqft">Sqft</Option>
              <Option value="Kg">Kg</Option>
              <Option value="Set">Set</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="requiredQty"
            label="Required Quantity"
            rules={[{ required: true, message: "Required quantity is required" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="orderedQty" label="Ordered Quantity">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="receivedQty" label="Received Quantity">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="supplier" label="Supplier">
            <Input placeholder="Supplier / vendor name" />
          </Form.Item>

          <Form.Item name="expectedDelivery" label="Expected Delivery">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="status" label="Status">
            <Select placeholder="Select status">
              <Option value="Pending">Pending</Option>
              <Option value="Ordered">Ordered</Option>
              <Option value="Partially Received">Partially Received</Option>
              <Option value="Received">Received</Option>
              <Option value="Cancelled">Cancelled</Option>
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