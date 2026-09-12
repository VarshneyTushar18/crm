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
import { FormOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useJob } from "../../context/JobContext";
import { getJobs, updateJob, updateJobStage } from "../Jobs/jobApi";
import {
  getQcItems,
  createQcItem,
  updateQcItem,
  deleteQcItem,
} from "./qcApi";
import {
  getNcrItems,
  createNcrItem,
  recordReinspection,
} from "./ncrApi";
import { isStageComplete } from "@/config/workflowConfig";

import { markPowderCoatingComplete } from "@/api/extensionApi";

const INSPECTION_TYPES = [
  { label: "Finishing & QC", value: "Finishing & QC", stage: "finishing" },
  { label: "Fabrication QC", value: "Fabrication QC", stage: "fabricationQc" },
  { label: "Powder Coating QC", value: "Powder Coating QC", stage: "powderCoatingQc" },
];
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

const NCR_STATUS_COLORS = {
  Open: "gold",
  "In Progress": "blue",
  Closed: "green",
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
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();
  const [ncrForm] = Form.useForm();
  const [reinspectForm] = Form.useForm();
  const [ncrItems, setNcrItems] = useState([]);
  const [ncrOpen, setNcrOpen] = useState(false);
  const [reinspectOpen, setReinspectOpen] = useState(false);
  const [ncrLoading, setNcrLoading] = useState(false);
  const [selectedQcForNcr, setSelectedQcForNcr] = useState(null);
  const [selectedNcr, setSelectedNcr] = useState(null);

  const queryJobId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("jobId");
  }, [location.search]);

  const jobId = queryJobId || activeJobId || localStorage.getItem("activeJobId");
  const jobKey = jobId ? `activeJobData_${jobId}` : null;

  const eligibleJobs = useMemo(() => {
    return Array.isArray(jobs)
      ? jobs.filter((job) => isStageComplete(job, "fabrication"))
      : [];
  }, [jobs]);

  const stageFilterOptions = useMemo(() => {
    const stages = [
      ...new Set(eligibleJobs.map((job) => job.stage).filter(Boolean)),
    ];
    return stages.sort().map((stage) => ({ text: stage, value: stage }));
  }, [eligibleJobs]);

  const clearStaleJobSelection = () => {
    setJobData(null);
    setItems([]);
    setNcrItems([]);
    setActiveJobId(null);
    localStorage.removeItem("activeJobId");
    navigate("/admin/qc", { replace: true });
  };

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

  const fetchNcr = async (resolvedJobId) => {
    if (!resolvedJobId) {
      setNcrItems([]);
      return;
    }
    try {
      const result = await getNcrItems(resolvedJobId);
      setNcrItems(Array.isArray(result) ? result : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to fetch NCR items"
      );
      setNcrItems([]);
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
        setNcrItems([]);
        return;
      }

      const job = await resolveJobData(jobId);

      if (!job) {
        message.warning("Please select a job first");
        return;
      }

      if (!isStageComplete(job, "fabrication")) {
        message.warning("This job is not eligible for Quality Control.");
        clearStaleJobSelection();
        return;
      }

      await Promise.all([fetchItems(jobId), fetchNcr(jobId)]);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, location.state, jobs.length]);

  const onJobChange = (selectedJobId) => {
    if (!selectedJobId) {
      clearStaleJobSelection();
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
    fetchNcr(selectedJobId);
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

  const openViewModal = (record) => {
    setViewItem(record);
    setViewOpen(true);
  };

  const closeViewModal = () => {
    setViewOpen(false);
    setViewItem(null);
  };

  const onSubmit = async (values) => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    const stageMeta = INSPECTION_TYPES.find((t) => t.value === values.inspectionType);
    const payload = {
      jobId,
      itemName: values.itemName,
      inspectionType: values.inspectionType || "",
      workflowStageKey: stageMeta?.stage || "",
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

      await Promise.all([fetchItems(jobId), fetchNcr(jobId)]);
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
      await Promise.all([fetchItems(jobId), fetchNcr(jobId)]);
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
      await Promise.all([fetchItems(jobId), fetchNcr(jobId)]);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Delete failed"
      );
    }
  };

  const getNcrForQc = (qcId) =>
    (Array.isArray(ncrItems) ? ncrItems : []).find((n) => {
      const linkedQcId =
        typeof n?.qcItemId === "string" ? n.qcItemId : n?.qcItemId?._id;
      return linkedQcId === qcId;
    });

  const openCreateNcrModal = (record) => {
    setSelectedQcForNcr(record);
    ncrForm.setFieldsValue({
      title: `NCR for ${record.itemName}`,
      description: record.remarks || "",
      dueDate: null,
    });
    setNcrOpen(true);
  };

  const closeNcrModal = () => {
    setNcrOpen(false);
    setSelectedQcForNcr(null);
    ncrForm.resetFields();
  };

  const onSubmitNcr = async (values) => {
    if (!jobId || !selectedQcForNcr?._id) return;
    try {
      setNcrLoading(true);
      await createNcrItem({
        jobId,
        qcItemId: selectedQcForNcr._id,
        title: values.title,
        description: values.description || "",
        rootCause: values.rootCause || "",
        correctiveAction: values.correctiveAction || "",
        assignedTo: values.assignedTo || "",
        dueDate: values.dueDate ? values.dueDate.format("YYYY-MM-DD") : "",
      });
      message.success("NCR created successfully");
      closeNcrModal();
      await Promise.all([fetchNcr(jobId), fetchItems(jobId)]);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to create NCR"
      );
    } finally {
      setNcrLoading(false);
    }
  };

  const openReinspectModal = (record) => {
    setSelectedNcr(record);
    reinspectForm.setFieldsValue({
      result: "Pass",
      checkedDate: dayjs(),
      notes: "",
    });
    setReinspectOpen(true);
  };

  const closeReinspectModal = () => {
    setReinspectOpen(false);
    setSelectedNcr(null);
    reinspectForm.resetFields();
  };

  const onSubmitReinspect = async (values) => {
    if (!selectedNcr?._id || !jobId) return;
    try {
      setNcrLoading(true);
      await recordReinspection(selectedNcr._id, {
        result: values.result,
        checkedBy: values.checkedBy || "",
        checkedDate: values.checkedDate
          ? values.checkedDate.format("YYYY-MM-DD")
          : "",
        notes: values.notes || "",
      });
      message.success("Re-inspection result recorded");
      closeReinspectModal();
      await Promise.all([fetchNcr(jobId), fetchItems(jobId)]);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to record re-inspection"
      );
    } finally {
      setNcrLoading(false);
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

    const now = new Date().toISOString();
    const indicator = items
      .map((item) => `${item.itemName}: ${item.status}`)
      .join("; ");

    try {
      setCompleting(true);

      await updateJobStage(jobId, "finishing", {
        startExpected: now,
        startActual: now,
        completionExpected: now,
        completionActual: now,
        qualityCheckIndicator: indicator,
        isCompleted: true,
      });

      await updateJob(jobId, {
        stage: "Installation",
        status: "Active",
      });

      message.success("QC submitted for site engineer review. Job moved to Installation.");
      navigate(`/admin/installation?jobId=${jobId}`);
    } catch (err) {
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
      title: "NCR",
      width: 190,
      render: (_, record) => {
        const ncr = getNcrForQc(record._id);
        if (!ncr) {
          const canCreate = ["Fail", "Rework"].includes(record.status);
          return canCreate ? (
            <Button size="small" onClick={() => openCreateNcrModal(record)}>
              Create NCR
            </Button>
          ) : (
            "-"
          );
        }

        return (
          <Space direction="vertical" size={4}>
            <Tag color={NCR_STATUS_COLORS[ncr.status] || "default"}>{ncr.ncrNumber}</Tag>
            <Tag>{ncr.reinspectionStatus || "Pending"}</Tag>
            {ncr.status !== "Closed" ? (
              <Button size="small" type="link" onClick={() => openReinspectModal(ncr)}>
                Re-inspect
              </Button>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: "Actions",
      width: 220,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<FormOutlined />}
            onClick={() => openViewModal(record)}
            title="View form"
          />
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

  const eligibleJobColumns = [
    {
      title: "Job",
      key: "job",
      width: 220,
      render: (_, record) => (
        <Button
          type="link"
          style={{ padding: 0, height: "auto", fontWeight: 600 }}
          onClick={(e) => {
            e.stopPropagation();
            onJobChange(record._id);
          }}
        >
          {record.jobId || record._id}
          {record.customer ? ` - ${record.customer}` : ""}
        </Button>
      ),
    },
    {
      title: "Customer",
      dataIndex: "customer",
      render: (v) => v || "—",
      width: 160,
    },
    {
      title: "Site",
      dataIndex: "site",
      render: (v) => v || "—",
      width: 200,
    },
    {
      title: "Stage",
      dataIndex: "stage",
      width: 150,
      filters: stageFilterOptions,
      onFilter: (value, record) => record.stage === value,
      render: (v) => (
        <Tag color={JOB_STAGE_COLORS[v] || "default"}>{v || "—"}</Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (v) => (
        <Tag color={JOB_STATUS_COLORS[v] || "default"}>{v || "—"}</Tag>
      ),
    },
  ];

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
          {jobId ? (
            <Button icon={<ArrowLeftOutlined />} onClick={() => onJobChange(null)}>
              Back to Jobs List
            </Button>
          ) : null}
          <Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>
          <Button type="primary" onClick={openCreateModal}>
            + Add QC Item
          </Button>
          <Button type="primary" onClick={completeQc} loading={completing}>
            Mark QC Complete
          </Button>
          <Button
            onClick={async () => {
              if (!jobId) return message.warning("Select a job first");
              const batchRef = window.prompt("Enter powder coating batch reference (required):");
              if (!String(batchRef || "").trim()) {
                message.warning("Batch reference is required to close powder coating");
                return;
              }
              try {
                await markPowderCoatingComplete(jobId, batchRef.trim());
                message.success("Powder coating submitted for site engineer review");
                await fetchItems(jobId);
              } catch (err) {
                message.error(err?.response?.data?.message || "Failed");
              }
            }}
          >
            Mark Powder Coating Done
          </Button>
        </Space>
      </Space>

      {jobId ? (
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
                value={
                  eligibleJobs.some((job) => job._id === jobId) ? jobId : undefined
                }
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
      ) : null}

      {!jobId ? (
        <Card title="Eligible Jobs">
          {eligibleJobs.length === 0 && !loadingJobs ? (
            <Empty description="No eligible jobs. Complete Fabrication first." />
          ) : (
            <div className="table-responsive-wrap">
              <Table
                columns={eligibleJobColumns}
                dataSource={eligibleJobs}
                rowKey="_id"
                loading={loadingJobs}
                pagination={{
                  pageSize: 10,
                  showTotal: (total) => `Total ${total} jobs`,
                }}
                scroll={{ x: "max-content" }}
                onRow={(record) => ({
                  onClick: () => onJobChange(record._id),
                  style: { cursor: "pointer" },
                })}
              />
            </div>
          )}
        </Card>
      ) : !jobData ? (
        <Card>
          {loadingJobs || loadingItems ? (
            <Spin />
          ) : (
            <Empty description="Selected job is not eligible or could not be loaded. Pick a job from the list." />
          )}
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

          <Card title="NCR / Re-inspection Tracker" style={{ marginTop: 16 }}>
            {!ncrItems.length ? (
              <Empty description="No NCRs created for this job yet." />
            ) : (
              <Table
                rowKey="_id"
                pagination={{ pageSize: 5 }}
                dataSource={ncrItems}
                columns={[
                  { title: "NCR No.", dataIndex: "ncrNumber", width: 160 },
                  { title: "Title", dataIndex: "title", width: 220 },
                  {
                    title: "QC Item",
                    width: 180,
                    render: (_, row) => row?.qcItemId?.itemName || "-",
                  },
                  {
                    title: "Status",
                    width: 120,
                    render: (_, row) => (
                      <Tag color={NCR_STATUS_COLORS[row.status] || "default"}>
                        {row.status}
                      </Tag>
                    ),
                  },
                  {
                    title: "Re-inspection",
                    dataIndex: "reinspectionStatus",
                    width: 140,
                  },
                  {
                    title: "Action",
                    width: 120,
                    render: (_, row) =>
                      row.status !== "Closed" ? (
                        <Button size="small" onClick={() => openReinspectModal(row)}>
                          Re-inspect
                        </Button>
                      ) : (
                        "-"
                      ),
                  },
                ]}
              />
            )}
          </Card>
        </>
      )}

      <Modal
        title="QC Item — Form View"
        open={viewOpen}
        onCancel={closeViewModal}
        footer={[
          <Button key="close" onClick={closeViewModal}>
            Close
          </Button>,
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              closeViewModal();
              if (viewItem) openEditModal(viewItem);
            }}
          >
            Edit
          </Button>,
        ]}
        width={560}
      >
        {viewItem ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Item Name">{viewItem.itemName || "-"}</Descriptions.Item>
            <Descriptions.Item label="Inspection Type">
              {viewItem.inspectionType || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Workflow Stage">
              {viewItem.workflowStageKey || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Checked By">{viewItem.checkedBy || "-"}</Descriptions.Item>
            <Descriptions.Item label="Checked Date">{viewItem.checkedDate || "-"}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={QC_STATUS_COLORS[viewItem.status] || "default"}>
                {viewItem.status || "Pending"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Remarks">{viewItem.remarks || "-"}</Descriptions.Item>
            <Descriptions.Item label="Created">
              {viewItem.createdAt ? dayjs(viewItem.createdAt).format("DD MMM YYYY HH:mm") : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Last Updated">
              {viewItem.updatedAt ? dayjs(viewItem.updatedAt).format("DD MMM YYYY HH:mm") : "-"}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

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
            <Select placeholder="Select QC stage">
              {INSPECTION_TYPES.map((t) => (
                <Option key={t.value} value={t.value}>
                  {t.label}
                </Option>
              ))}
            </Select>
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

      <Modal
        title="Create Non-Conformance Report (NCR)"
        open={ncrOpen}
        onCancel={closeNcrModal}
        onOk={() => ncrForm.submit()}
        okText="Create NCR"
        confirmLoading={ncrLoading}
      >
        <Form form={ncrForm} layout="vertical" onFinish={onSubmitNcr}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: "NCR title is required" }]}
          >
            <Input placeholder="NCR title" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Issue details" />
          </Form.Item>
          <Form.Item name="rootCause" label="Root Cause">
            <TextArea rows={2} placeholder="Root cause analysis" />
          </Form.Item>
          <Form.Item name="correctiveAction" label="Corrective Action">
            <TextArea rows={2} placeholder="Corrective action plan" />
          </Form.Item>
          <Form.Item name="assignedTo" label="Assigned To">
            <Input placeholder="Responsible person/team" />
          </Form.Item>
          <Form.Item name="dueDate" label="Due Date">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedNcr ? `Re-inspection: ${selectedNcr.ncrNumber}` : "Re-inspection"}
        open={reinspectOpen}
        onCancel={closeReinspectModal}
        onOk={() => reinspectForm.submit()}
        okText="Save Result"
        confirmLoading={ncrLoading}
      >
        <Form form={reinspectForm} layout="vertical" onFinish={onSubmitReinspect}>
          <Form.Item
            name="result"
            label="Result"
            rules={[{ required: true, message: "Result is required" }]}
          >
            <Select>
              <Option value="Pass">Pass</Option>
              <Option value="Fail">Fail</Option>
            </Select>
          </Form.Item>
          <Form.Item name="checkedBy" label="Checked By">
            <Input placeholder="Inspector name" />
          </Form.Item>
          <Form.Item name="checkedDate" label="Checked Date">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Re-inspection notes" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}