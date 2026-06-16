import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
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
  Upload,
  message,
  Spin,
  Divider,
  Checkbox,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate, useLocation } from "react-router-dom";
import { useJob } from "../../context/JobContext";
import { getJobs, updateJob } from "../Jobs/jobApi";
import { getEmployees } from "../Employee/employeeApi";
import {
  getInstallationItems,
  createInstallationItem,
  updateInstallationItem,
  deleteInstallationItem,
  getInstallationSummary,
  saveInstallationSummary,
  markInstallationComplete,
  finalizeJobCompletion,
} from "./installationApi";

const { Option } = Select;
const { TextArea } = Input;

const normFile = (e) => {
  if (Array.isArray(e)) {
    return e;
  }
  return e?.fileList;
};

const ACTIVITY_STATUSES = ["Pending", "In Progress", "Completed", "Hold", "Snag"];

const STATUS_COLORS = {
  Pending: "default",
  "In Progress": "blue",
  Completed: "green",
  Hold: "orange",
  Snag: "red",
};

const JOB_STATUS_COLORS = {
  Backlog: "default",
  Active: "processing",
  "On Hold": "warning",
  Completed: "success",
};

export default function Installation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeJobId, setActiveJobId } = useJob?.() || {};

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    installationScheduledDate: null,
    assignedTeam: [],
    expectedHours: 0,
    actualHours: 0,
    completionConfirmed: false,
    completionConfirmedAt: null,
    completionRemarks: "",
    customerSignOffDone: false,
    customerName: "",
    completionDate: null,
    completionPictures: [],
    completionDocuments: [],
  });

  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [completionModalOpen, setCompletionModalOpen] = useState(false);

  const [activityForm] = Form.useForm();
  const [summaryForm] = Form.useForm();
  const [completionForm] = Form.useForm();

  useEffect(() => {
    loadJobs();
    loadEmployees();
  }, []);

  useEffect(() => {
    if (!jobs.length) return;

    const stateJob = location?.state?.fromJob;
    if (stateJob?._id) {
      setSelectedJob(stateJob);
      setActiveJobId?.(stateJob._id);
      return;
    }

    if (activeJobId) {
      const found = jobs.find((j) => j._id === activeJobId);
      if (found) setSelectedJob(found);
    }
  }, [jobs, activeJobId, location?.state, setActiveJobId]);

  useEffect(() => {
    if (selectedJob?._id) {
      loadInstallationData(selectedJob._id);
    } else {
      setItems([]);
      resetSummary();
    }
  }, [selectedJob]);

  const resetSummary = () => {
    const emptySummary = {
      installationScheduledDate: null,
      assignedTeam: [],
      expectedHours: 0,
      actualHours: 0,
      completionConfirmed: false,
      completionConfirmedAt: null,
      completionRemarks: "",
      customerSignOffDone: false,
      customerName: "",
      completionDate: null,
      completionPictures: [],
      completionDocuments: [],
    };

    setSummary(emptySummary);
    summaryForm.setFieldsValue({
      installationScheduledDate: null,
      assignedTeam: [],
      expectedHours: 0,
      actualHours: 0,
      completionConfirmed: false,
      completionRemarks: "",
    });
  };

  const normalizeJobs = (jobList) =>
    Array.isArray(jobList)
      ? jobList
      : Array.isArray(jobList?.result)
        ? jobList.result
        : Array.isArray(jobList?.data)
          ? jobList.data
          : [];

  const normalizeEmployees = (data) =>
    Array.isArray(data)
      ? data
      : Array.isArray(data?.result)
        ? data.result
        : [];

  const loadJobs = async () => {
    try {
      setLoading(true);
      const jobList = await getJobs();
      setJobs(normalizeJobs(jobList));
    } catch (err) {
      console.error(err);
      message.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await getEmployees();
      setEmployees(normalizeEmployees(data));
    } catch (err) {
      console.error(err);
      message.error("Failed to load employees");
    }
  };

  const loadInstallationData = async (jobId) => {
    try {
      setLoading(true);

      const [activityData, summaryData] = await Promise.all([
        getInstallationItems(jobId),
        getInstallationSummary(jobId).catch(() => ({})),
      ]);

      const normalizedItems = Array.isArray(activityData) ? activityData : [];
      setItems(normalizedItems);

      const normalizedSummary = {
        installationScheduledDate: summaryData?.installationScheduledDate
          ? dayjs(summaryData.installationScheduledDate)
          : null,
        assignedTeam: Array.isArray(summaryData?.assignedTeam)
          ? summaryData.assignedTeam
          : [],
        expectedHours: Number(summaryData?.expectedHours || 0),
        actualHours: Number(summaryData?.actualHours || 0),
        completionConfirmed: !!summaryData?.completionConfirmed,
        completionConfirmedAt: summaryData?.completionConfirmedAt
          ? dayjs(summaryData.completionConfirmedAt)
          : null,
        completionRemarks: summaryData?.completionRemarks || "",
        customerSignOffDone: !!summaryData?.customerSignOffDone,
        customerName: summaryData?.customerName || "",
        completionDate: summaryData?.completionDate
          ? dayjs(summaryData.completionDate)
          : null,
        completionPictures: Array.isArray(summaryData?.completionPictures)
          ? summaryData.completionPictures
          : [],
        completionDocuments: Array.isArray(summaryData?.completionDocuments)
          ? summaryData.completionDocuments
          : [],
      };

      setSummary(normalizedSummary);

      summaryForm.setFieldsValue({
        installationScheduledDate: normalizedSummary.installationScheduledDate,
        assignedTeam: normalizedSummary.assignedTeam,
        expectedHours: normalizedSummary.expectedHours,
        actualHours: normalizedSummary.actualHours,
        completionConfirmed: normalizedSummary.completionConfirmed,
        completionRemarks: normalizedSummary.completionRemarks,
      });
    } catch (err) {
      console.error(err);
      message.error("Failed to load installation data");
    } finally {
      setLoading(false);
    }
  };
  const eligibleJobs = useMemo(() => {
    return Array.isArray(jobs)
      ? jobs.filter((job) => {
        const stage = String(job?.stage || "").trim();

        return (
          job?.workflowEvents?.qc?.isCompleted === true ||
          job?.workflowEvents?.finishing?.isCompleted === true ||
          stage === "Installation" ||
          stage === "Closure"
        );
      })
      : [];
  }, [jobs]);

  const totalExpectedFromActivities = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item?.expectedHours || 0), 0);
  }, [items]);

  const totalActualFromActivities = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item?.actualHours || 0), 0);
  }, [items]);

  const currentInstallationStatus = useMemo(() => {
    if (!items.length) return "Pending";
    if (items.every((x) => x.status === "Completed")) return "Completed";
    if (items.some((x) => x.status === "Snag")) return "Snag";
    if (items.some((x) => x.status === "Hold")) return "Hold";
    if (items.some((x) => x.status === "In Progress")) return "In Progress";
    return "Pending";
  }, [items]);

  const canMarkInstallationComplete = useMemo(() => {
    if (!selectedJob?._id) return false;
    if (!items.length) return false;
    return items.every((item) => item.status === "Completed");
  }, [items, selectedJob]);

  const forceJobStageToInstallation = async (jobId) => {
    try {
      await updateJob(jobId, {
        stage: "Installation",
        status: "Active",
      });
    } catch (err) {
      console.warn("Could not force stage to Installation:", err);
    }
  };

  const openCreateModal = () => {
    if (!selectedJob?._id) {
      message.warning("Please select a job first");
      return;
    }

    setEditingItem(null);
    activityForm.resetFields();
    activityForm.setFieldsValue({
      activityName: "",
      locationArea: "",
      assignedTeam: [],
      plannedDate: null,
      completedDate: null,
      status: "Pending",
      snagIssue: "",
      remarks: "",
      expectedHours: 0,
      actualHours: 0,
    });
    setActivityModalOpen(true);
  };

  const openEditModal = (record) => {
    setEditingItem(record);
    activityForm.setFieldsValue({
      activityName: record.activityName || "",
      locationArea: record.locationArea || "",
      assignedTeam: record.assignedTeam || [],
      plannedDate: record.plannedDate ? dayjs(record.plannedDate) : null,
      completedDate: record.completedDate ? dayjs(record.completedDate) : null,
      status: record.status || "Pending",
      snagIssue: record.snagIssue || "",
      remarks: record.remarks || "",
      expectedHours: record.expectedHours || 0,
      actualHours: record.actualHours || 0,
    });
    setActivityModalOpen(true);
  };

  const closeActivityModal = () => {
    setActivityModalOpen(false);
    setEditingItem(null);
    activityForm.resetFields();
  };

  const openCompletionModal = () => {
    completionForm.setFieldsValue({
      customerName: summary.customerName || "",
      customerSignOffDone: summary.customerSignOffDone || false,
      completionDate: summary.completionDate || null,
      completionRemarks: summary.completionRemarks || "",
      completionPictures: [],
      completionDocuments: [],
      customerSignatureFile: [],
    });
    setCompletionModalOpen(true);
  };

  const closeCompletionModal = () => {
    setCompletionModalOpen(false);
    completionForm.resetFields();
  };

  const handleSaveActivity = async () => {
    try {
      const values = await activityForm.validateFields();

      if (!selectedJob?._id) {
        message.warning("Please select a job first");
        return;
      }

      setSaving(true);

      const payload = {
        jobId: selectedJob._id,
        activityName: values.activityName,
        locationArea: values.locationArea || "",
        assignedTeam: values.assignedTeam || [],
        plannedDate: values.plannedDate
          ? values.plannedDate.format("YYYY-MM-DD")
          : "",
        completedDate: values.completedDate
          ? values.completedDate.format("YYYY-MM-DD")
          : "",
        status: values.status,
        snagIssue: values.snagIssue || "",
        remarks: values.remarks || "",
        expectedHours: Number(values.expectedHours || 0),
        actualHours: Number(values.actualHours || 0),
      };

      if (editingItem?._id) {
        await updateInstallationItem(editingItem._id, payload);
        message.success("Installation activity updated");
      } else {
        await createInstallationItem(payload);
        message.success("Installation activity created");
      }

      await forceJobStageToInstallation(selectedJob._id);
      closeActivityModal();
      await loadInstallationData(selectedJob._id);
    } catch (err) {
      console.error(err);
      if (err?.errorFields) return;
      message.error("Failed to save installation activity");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActivity = async (id) => {
    try {
      await deleteInstallationItem(id);
      message.success("Installation activity deleted");
      if (selectedJob?._id) {
        await loadInstallationData(selectedJob._id);
      }
    } catch (err) {
      console.error(err);
      message.error("Failed to delete installation activity");
    }
  };

  const handleSaveSummary = async () => {
    try {
      const values = await summaryForm.validateFields();

      if (!selectedJob?._id) {
        message.warning("Please select a job first");
        return;
      }

      setSaving(true);

      const payload = {
        installationScheduledDate: values.installationScheduledDate
          ? values.installationScheduledDate.format("YYYY-MM-DD")
          : "",
        assignedTeam: values.assignedTeam || [],
        expectedHours: Number(values.expectedHours || 0),
        actualHours: Number(values.actualHours || 0),
        completionConfirmed: !!values.completionConfirmed,
        completionConfirmedAt: values.completionConfirmed
          ? dayjs().format("YYYY-MM-DD HH:mm:ss")
          : null,
        completionRemarks: values.completionRemarks || "",
      };

      await saveInstallationSummary(selectedJob._id, payload);
      await forceJobStageToInstallation(selectedJob._id);
      message.success("Installation schedule and execution details saved");
      await loadInstallationData(selectedJob._id);
    } catch (err) {
      console.error(err);
      if (err?.errorFields) return;
      message.error("Failed to save installation summary");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkInstallationComplete = async () => {
    if (!selectedJob?._id) {
      message.warning("Please select a job first");
      return;
    }

    if (!canMarkInstallationComplete) {
      message.warning("All installation activities must be Completed first");
      return;
    }

    try {
      setSaving(true);
      await markInstallationComplete(selectedJob._id);
      message.success("Installation completion confirmed");
      await loadJobs();
      await loadInstallationData(selectedJob._id);
    } catch (err) {
      console.error(err);
      message.error("Failed to mark installation complete");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeCompletion = async () => {
    try {
      const values = await completionForm.validateFields();

      if (!selectedJob?._id) {
        message.warning("Please select a job first");
        return;
      }

      if (!values.customerSignOffDone) {
        message.warning("Customer sign-off is required before job closure");
        return;
      }

      if (!values.completionDate) {
        message.warning("Completion date is required");
        return;
      }

      if (!values.completionPictures?.length) {
        message.warning("Please upload at least one completion picture");
        return;
      }

      setSaving(true);

      const formData = new FormData();
      formData.append("jobId", selectedJob._id);
      formData.append("customerName", values.customerName || "");
      formData.append("customerSignOffDone", String(!!values.customerSignOffDone));
      formData.append("completionDate", values.completionDate.format("YYYY-MM-DD"));
      formData.append("completionRemarks", values.completionRemarks || "");

      (values.customerSignatureFile || []).forEach((fileObj) => {
        if (fileObj?.originFileObj) {
          formData.append("customerSignatureFile", fileObj.originFileObj);
        }
      });

      (values.completionPictures || []).forEach((fileObj) => {
        if (fileObj?.originFileObj) {
          formData.append("completionPictures", fileObj.originFileObj);
        }
      });

      (values.completionDocuments || []).forEach((fileObj) => {
        if (fileObj?.originFileObj) {
          formData.append("completionDocuments", fileObj.originFileObj);
        }
      });

      await finalizeJobCompletion(selectedJob._id, formData);

      try {
        await updateJob(selectedJob._id, {
          stage: "Closure",
          status: "Completed",
        });
      } catch (err) {
        console.warn("Job stage update to Closure failed:", err);
      }

      message.success("Job completion and customer sign-off saved");
      closeCompletionModal();
      await loadJobs();
      await loadInstallationData(selectedJob._id);
    } catch (err) {
      console.error(err);
      if (err?.errorFields) return;
      message.error("Failed to finalize job completion");
    } finally {
      setSaving(false);
    }
  };

  const uploadProps = {
    beforeUpload: () => false,
    multiple: true,
  };

  const columns = [
    {
      title: "Activity Name",
      dataIndex: "activityName",
      key: "activityName",
      width: 180,
    },
    {
      title: "Location / Area",
      dataIndex: "locationArea",
      key: "locationArea",
      width: 160,
      render: (value) => value || "—",
    },
    {
      title: "Assigned Installer / Team",
      dataIndex: "assignedTeam",
      key: "assignedTeam",
      width: 220,
      render: (value) =>
        Array.isArray(value) && value.length ? value.join(", ") : "—",
    },
    {
      title: "Scheduled Date",
      dataIndex: "plannedDate",
      key: "plannedDate",
      width: 130,
      render: (value) => (value ? dayjs(value).format("DD-MM-YYYY") : "—"),
    },
    {
      title: "Completed Date",
      dataIndex: "completedDate",
      key: "completedDate",
      width: 130,
      render: (value) => (value ? dayjs(value).format("DD-MM-YYYY") : "—"),
    },
    {
      title: "Expected Hours",
      dataIndex: "expectedHours",
      key: "expectedHours",
      width: 120,
      render: (v) => Number(v || 0),
    },
    {
      title: "Actual Hours",
      dataIndex: "actualHours",
      key: "actualHours",
      width: 110,
      render: (v) => Number(v || 0),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status) => (
        <Tag color={STATUS_COLORS[status] || "default"}>{status || "—"}</Tag>
      ),
    },
    {
      title: "Snag / Issue",
      dataIndex: "snagIssue",
      key: "snagIssue",
      width: 180,
      ellipsis: true,
      render: (value) => value || "—",
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      key: "remarks",
      width: 220,
      ellipsis: true,
      render: (value) => value || "—",
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      render: (_, record) => (
        <Space wrap>
          <Button icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this activity?"
            onConfirm={() => handleDeleteActivity(record._id)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title="Installation"
            extra={
              <Space wrap>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/admin/jobs")}
                >
                  Back to Jobs
                </Button>

                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreateModal}
                  disabled={!selectedJob}
                >
                  Add Installation Activity
                </Button>

                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={handleMarkInstallationComplete}
                  disabled={!canMarkInstallationComplete}
                  loading={saving}
                >
                  Confirm Installation Completion
                </Button>

                <Button
                  type="primary"
                  icon={<FileDoneOutlined />}
                  onClick={openCompletionModal}
                  disabled={!selectedJob}
                >
                  Job Completion & Customer Sign-Off
                </Button>
              </Space>
            }
          >
            <div style={{ color: "#666" }}>
              Only QC-approved / Finishing-completed jobs are available here.
            </div>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Search Eligible Job">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>Select Job</div>
                <Select
                  showSearch
                  allowClear
                  placeholder="Search Installation / Closure job"
                  style={{ width: "100%" }}
                  value={selectedJob?._id}
                  optionFilterProp="children"
                  onChange={(value) => {
                    const found = eligibleJobs.find((j) => j._id === value);
                    setSelectedJob(found || null);
                    setActiveJobId?.(value || null);
                  }}
                  filterOption={(input, option) =>
                    String(option?.children || "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {eligibleJobs.map((job) => (
                    <Option key={job._id} value={job._id}>
                      {job.customer || job.customerName || job.clientName || job.client || "Customer"} ({job.jobId || job.code || "Job"})
                    </Option>
                  ))}
                </Select>
              </Col>

              <Col xs={24} md={6}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>
                  Installation Status
                </div>
                <Tag color={STATUS_COLORS[currentInstallationStatus] || "default"}>
                  {currentInstallationStatus}
                </Tag>
              </Col>

              <Col xs={24} md={6}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>Job Status</div>
                <Tag color={JOB_STATUS_COLORS[selectedJob?.status] || "default"}>
                  {selectedJob?.status || "—"}
                </Tag>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Job Summary">
            {selectedJob ? (
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                <Descriptions.Item label="Job ID">
                  {selectedJob?.jobId || selectedJob?.code || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Customer">
                  {selectedJob?.customer ||
                    selectedJob?.clientName ||
                    selectedJob?.customerName ||
                    selectedJob?.client ||
                    "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Site">
                  {selectedJob?.siteAddress || selectedJob?.site || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Stage">
                  <Tag color="blue">{selectedJob?.stage || "—"}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={JOB_STATUS_COLORS[selectedJob?.status] || "default"}>
                    {selectedJob?.status || "—"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Installation Scheduled Date">
                  {summary.installationScheduledDate
                    ? dayjs(summary.installationScheduledDate).format("DD-MM-YYYY")
                    : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Assigned Installer / Team">
                  {summary.assignedTeam?.length ? summary.assignedTeam.join(", ") : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Expected Hours">
                  {summary.expectedHours || totalExpectedFromActivities || 0}
                </Descriptions.Item>
                <Descriptions.Item label="Actual Hours">
                  {summary.actualHours || totalActualFromActivities || 0}
                </Descriptions.Item>
                <Descriptions.Item label="Installation Completion Confirmed">
                  <Tag color={summary.completionConfirmed ? "green" : "default"}>
                    {summary.completionConfirmed ? "Yes" : "No"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Customer Sign-Off">
                  <Tag color={summary.customerSignOffDone ? "green" : "default"}>
                    {summary.customerSignOffDone ? "Done" : "Pending"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Completion Date">
                  {summary.completionDate
                    ? dayjs(summary.completionDate).format("DD-MM-YYYY")
                    : "—"}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description="Select a job to view installation details" />
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Installation Scheduling & Execution Summary">
            <Form form={summaryForm} layout="vertical">
              <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Installation Scheduled Date"
                    name="installationScheduledDate"
                    rules={[
                      {
                        required: true,
                        message: "Please select installation scheduled date",
                      },
                    ]}
                  >
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    label="Assigned Installer / Team"
                    name="assignedTeam"
                    rules={[
                      {
                        required: true,
                        message: "Please select assigned installer/team",
                      },
                    ]}
                  >
                    <Select
                      mode="multiple"
                      showSearch
                      placeholder="Select installers / team"
                      optionFilterProp="children"
                    >
                      {employees.map((emp) => (
                        <Option key={emp._id} value={emp.name}>
                          {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ""}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={4}>
                  <Form.Item
                    label="Expected Hours"
                    name="expectedHours"
                    rules={[{ required: true, message: "Enter expected hours" }]}
                  >
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={4}>
                  <Form.Item
                    label="Actual Hours"
                    name="actualHours"
                    rules={[{ required: true, message: "Enter actual hours" }]}
                  >
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    label="Installation Completion Confirmation"
                    name="completionConfirmed"
                    valuePropName="checked"
                  >
                    <Checkbox>Confirm installation completed at site</Checkbox>
                  </Form.Item>
                </Col>

                <Col xs={24} md={16}>
                  <Form.Item label="Execution / Completion Remarks" name="completionRemarks">
                    <TextArea
                      rows={3}
                      placeholder="Enter installation remarks, issues, handover notes, etc."
                    />
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Space wrap>
                    <Button
                      type="primary"
                      onClick={handleSaveSummary}
                      loading={saving}
                      disabled={!selectedJob}
                    >
                      Save Summary
                    </Button>

                    <Tag color="blue">
                      Activity Expected Hours: {totalExpectedFromActivities}
                    </Tag>
                    <Tag color="green">
                      Activity Actual Hours: {totalActualFromActivities}
                    </Tag>
                  </Space>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Installation Activities">
            <Spin spinning={loading}>
              <Table
                rowKey="_id"
                dataSource={items}
                columns={columns}
                scroll={{ x: 1800 }}
                pagination={{ pageSize: 10 }}
              />
            </Spin>
          </Card>
        </Col>
      </Row>

      <Modal
        open={activityModalOpen}
        title={editingItem ? "Edit Installation Activity" : "Add Installation Activity"}
        onCancel={closeActivityModal}
        onOk={handleSaveActivity}
        confirmLoading={saving}
        width={860}
        okText="Save"
      >
        <Form form={activityForm} layout="vertical">
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Activity Name"
                name="activityName"
                rules={[{ required: true, message: "Please enter activity name" }]}
              >
                <Input placeholder="e.g. Balcony Glass Fixing" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Location / Area" name="locationArea">
                <Input placeholder="e.g. Front Balcony / Staircase / Terrace" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                label="Assigned Installer / Team"
                name="assignedTeam"
                rules={[{ required: true, message: "Please select assigned team" }]}
              >
                <Select
                  mode="multiple"
                  showSearch
                  placeholder="Select installer / team members"
                  optionFilterProp="children"
                >
                  {employees.map((emp) => (
                    <Option key={emp._id} value={emp.name}>
                      {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ""}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Scheduled Date" name="plannedDate">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Completed Date" name="completedDate">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Expected Hours" name="expectedHours">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Actual Hours" name="actualHours">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Status"
                name="status"
                rules={[{ required: true, message: "Please select status" }]}
              >
                <Select>
                  {ACTIVITY_STATUSES.map((status) => (
                    <Option key={status} value={status}>
                      {status}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Snag / Issue" name="snagIssue">
                <Input placeholder="Enter snag / issue if any" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Remarks" name="remarks">
                <TextArea rows={4} placeholder="Enter work remarks" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        open={completionModalOpen}
        title="Job Completion & Customer Sign-Off"
        onCancel={closeCompletionModal}
        onOk={handleFinalizeCompletion}
        confirmLoading={saving}
        width={900}
        okText="Save & Move to Closure"
      >
        <Form form={completionForm} layout="vertical">
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Customer Name"
                name="customerName"
                rules={[{ required: true, message: "Please enter customer name" }]}
              >
                <Input placeholder="Enter customer name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Completion Date"
                name="completionDate"
                rules={[{ required: true, message: "Please select completion date" }]}
              >
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                label="Customer Digital Sign-Off"
                name="customerSignOffDone"
                valuePropName="checked"
              >
                <Checkbox>Customer sign-off received</Checkbox>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Customer Signature Upload"
                name="customerSignatureFile"
                valuePropName="fileList"
                getValueFromEvent={normFile}
              >
                <Upload {...uploadProps} listType="text">
                  <Button icon={<UploadOutlined />}>Upload Signature File</Button>
                </Upload>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Completion Pictures Upload"
                name="completionPictures"
                valuePropName="fileList"
                getValueFromEvent={normFile}
                rules={[
                  { required: true, message: "Please upload completion pictures" },
                ]}
              >
                <Upload {...uploadProps} listType="picture">
                  <Button icon={<UploadOutlined />}>Upload Pictures</Button>
                </Upload>
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                label="Completion Documents Upload"
                name="completionDocuments"
                valuePropName="fileList"
                getValueFromEvent={normFile}
              >
                <Upload {...uploadProps} listType="text">
                  <Button icon={<UploadOutlined />}>Upload Completion Documents</Button>
                </Upload>
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Completion Remarks / Handover Notes" name="completionRemarks">
                <TextArea
                  rows={4}
                  placeholder="Enter final completion remarks, handover notes, pending observations, etc."
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Divider style={{ marginTop: 8, marginBottom: 16 }} />
              <Space wrap>
                <Tag color={summary.completionConfirmed ? "green" : "orange"}>
                  Installation Completion: {summary.completionConfirmed ? "Confirmed" : "Pending"}
                </Tag>
                <Tag
                  color={
                    items.every((i) => i.status === "Completed") && items.length
                      ? "green"
                      : "orange"
                  }
                >
                  Activities Completed:{" "}
                  {items.every((i) => i.status === "Completed") && items.length
                    ? "Yes"
                    : "No"}
                </Tag>
              </Space>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}