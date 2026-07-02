import { useEffect, useMemo, useState } from "react";
import { getDraftingRecords } from "../Drafting/draftingApi";
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
  message,
  Empty,
  Card,
  Descriptions,
  Spin,
  Row,
  Col,
  Divider,
  Checkbox,
  Progress,
  Tooltip,
  Tabs,
  Timeline,
  Grid,
  Dropdown,
  Upload,
} from "antd";
import {
  MoreOutlined,
  EditOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  RiseOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { useJob } from "../../context/JobContext";
import { getJobs, updateJob } from "../Jobs/jobApi";
import {
  getFabricationItems,
  getFabricationHistory,
  createFabricationItem,
  updateFabricationItem,
  updateFabricationProgress,
  deleteFabricationItem,
  uploadFabricationFiles,
} from "./fabricationApi";
import SendForSiteEngineerButton from "@/components/SendForSiteEngineerButton";

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

const FAB_STATUS_COLORS = {
  Pending: "default",
  "In Progress": "blue",
  Completed: "green",
  Hold: "orange",
  Rework: "red",
};

const FABRICATION_CHECKLIST_OPTIONS = [
  { label: "IFC drawing verified", value: "ifcVerified" },
  { label: "Material available", value: "materialAvailable" },
  { label: "Cutting completed", value: "cuttingCompleted" },
  { label: "Assembly / welding completed", value: "weldingCompleted" },
  { label: "Grinding / finishing completed", value: "finishingCompleted" },
  { label: "Dimensions checked", value: "dimensionChecked" },
  { label: "Surface / polish checked", value: "surfaceChecked" },
  { label: "Ready for QC handover", value: "readyForQc" },
];

function normalizeChecklist(checklist = {}) {
  return FABRICATION_CHECKLIST_OPTIONS.reduce((acc, item) => {
    acc[item.value] = Boolean(checklist?.[item.value]);
    return acc;
  }, {});
}

function checklistPercent(checklist = {}) {
  const normalized = normalizeChecklist(checklist);
  const total = FABRICATION_CHECKLIST_OPTIONS.length;
  const completed = Object.values(normalized).filter(Boolean).length;

  return {
    total,
    completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

function sumHours(hoursLog = []) {
  return (Array.isArray(hoursLog) ? hoursLog : []).reduce(
    (sum, row) => sum + Number(row?.hours || 0),
    0
  );
}

function getUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user?.role || localStorage.getItem("role") || "admin";
  } catch {
    return localStorage.getItem("role") || "admin";
  }
}

function getDrawingProgress(item = {}) {
  const pct = Number(item.progressPercentage || 0);
  if (pct > 0) return pct;
  if (item.status === "Completed") return 100;
  return 0;
}

function calcOverallFromItems(items = []) {
  if (!items.length) return 0;
  const total = items.reduce((sum, item) => sum + getDrawingProgress(item), 0);
  return Math.round(total / items.length);
}

export default function Fabrication() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeJobId, setActiveJobId } = useJob();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const userRole = getUserRole();
  const isAdmin = userRole === "admin";
  const canUpdateProgress = ["admin", "worker"].includes(userRole);

  const [jobs, setJobs] = useState([]);
  const [jobData, setJobData] = useState(null);

  const [items, setItems] = useState([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [history, setHistory] = useState([]);
  const [draftingItems, setDraftingItems] = useState([]);
  const [ifcApproved, setIfcApproved] = useState(false);

  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [activeTab, setActiveTab] = useState("drawings");

  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [selectedHoursItem, setSelectedHoursItem] = useState(null);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [selectedProgressItem, setSelectedProgressItem] = useState(null);

  const [form] = Form.useForm();
  const [hoursForm] = Form.useForm();
  const [progressForm] = Form.useForm();

  const queryJobId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("jobId");
  }, [location.search]);

  const jobId = queryJobId || activeJobId || localStorage.getItem("activeJobId");
  const jobKey = jobId ? `activeJobData_${jobId}` : null;

  const eligibleJobs = useMemo(() => {
    return jobs.filter(
      (job) =>
        job?.workflowEvents?.drafting?.isCompleted &&
        job?.workflowEvents?.materialPurchasing?.isCompleted
    );
  }, [jobs]);

  const fabricationSummary = useMemo(() => {
    const totalItems = items.length;
    const completedItems = items.filter((x) => x.status === "Completed").length;
    const totalHours = items.reduce((sum, item) => sum + sumHours(item.hoursLog), 0);

    const checklistStats = items.map((item) => checklistPercent(item.checklist));
    const checklistCompleted =
      checklistStats.length > 0
        ? checklistStats.every((c) => c.percent === 100)
        : false;

    return {
      totalItems,
      completedItems,
      totalHours,
      checklistCompleted,
    };
  }, [items]);

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
      setOverallProgress(0);
      return;
    }

    setLoadingItems(true);
    try {
      const data = await getFabricationItems(resolvedJobId);
      const normalized = Array.isArray(data?.items)
        ? data.items.map((item) => ({
            ...item,
            progressPercentage: Number(item.progressPercentage || 0),
            checklist: normalizeChecklist(item.checklist),
            hoursLog: Array.isArray(item.hoursLog) ? item.hoursLog : [],
          }))
        : [];
      setItems(normalized);
      setOverallProgress(
        Number(data?.overallProgress || 0) || calcOverallFromItems(normalized)
      );
    } catch (err) {
      message.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to fetch fabrication items"
      );
      setItems([]);
      setOverallProgress(0);
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchHistory = async (resolvedJobId) => {
    if (!resolvedJobId) {
      setHistory([]);
      return;
    }

    setLoadingHistory(true);
    try {
      const logs = await getFabricationHistory(resolvedJobId);
      setHistory(Array.isArray(logs) ? logs : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to fetch fabrication history"
      );
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchDraftingStatus = async (resolvedJobId) => {
    if (!resolvedJobId) {
      setDraftingItems([]);
      setIfcApproved(false);
      return;
    }

    try {
      const drafts = await getDraftingRecords(resolvedJobId);
      const draftList = Array.isArray(drafts) ? drafts : [];

      setDraftingItems(draftList);

      const approved = draftList.some(
        (item) =>
          item?.status === "IFC Approved" ||
          item?.isIFCApproved === true
      );

      setIfcApproved(approved);
    } catch (err) {
      setDraftingItems([]);
      setIfcApproved(false);
      message.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to fetch drafting status"
      );
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
        setDraftingItems([]);
        setIfcApproved(false);
        return;
      }

      const job = await resolveJobData(jobId);

      if (!job) {
        message.warning("Please select a job first");
        return;
      }

      if (!job?.workflowEvents?.drafting?.isCompleted) {
        message.warning("This job is not eligible for Fabrication. Complete Drafting first.");
        setJobData(null);
        setItems([]);
        setDraftingItems([]);
        setIfcApproved(false);
        navigate("/admin/fabrication");
        return;
      }

      if (!job?.workflowEvents?.materialPurchasing?.isCompleted) {
        message.warning(
          "This job is not eligible for Fabrication. Complete Material Purchase first."
        );
        setJobData(null);
        setItems([]);
        setDraftingItems([]);
        setIfcApproved(false);
        navigate("/admin/fabrication");
        return;
      }

      await Promise.all([fetchItems(jobId), fetchDraftingStatus(jobId), fetchHistory(jobId)]);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, location.state, jobs.length]);

  const onJobChange = (selectedJobId) => {
    if (!selectedJobId) {
      setJobData(null);
      setItems([]);
      setDraftingItems([]);
      setIfcApproved(false);
      localStorage.removeItem("activeJobId");
      navigate("/admin/fabrication");
      return;
    }

    const selectedJob = eligibleJobs.find((j) => j._id === selectedJobId);

    if (!selectedJob) {
      message.warning("Only fabrication-eligible jobs are allowed here");
      return;
    }

    setCurrentJobContext(selectedJob);

    navigate(`/admin/fabrication?jobId=${selectedJobId}`, {
      state: { job: selectedJob },
    });
  };

  const resetModal = () => {
    setOpen(false);
    setEditingItem(null);
    form.resetFields();
  };

  const resetHoursModal = () => {
    setHoursModalOpen(false);
    setSelectedHoursItem(null);
    hoursForm.resetFields();
  };

  const resetProgressModal = () => {
    setProgressModalOpen(false);
    setSelectedProgressItem(null);
    progressForm.resetFields();
  };

  const openProgressModal = (record) => {
    if (!canUpdateProgress) {
      message.warning("You do not have permission to update progress");
      return;
    }
    setSelectedProgressItem(record);
    progressForm.setFieldsValue({
      progressPercentage: Number(record.progressPercentage || 0),
      remarks: "",
    });
    setProgressModalOpen(true);
  };

  const onUpdateProgress = async (values) => {
    if (!selectedProgressItem?._id) return;

    try {
      const res = await updateFabricationProgress(selectedProgressItem._id, {
        progressPercentage: Number(values.progressPercentage || 0),
        remarks: values.remarks || "",
      });

      setOverallProgress(Number(res?.overallProgress || 0));

      if (res?.timelineUpdated) {
        message.success("Progress saved. Fabrication stage auto-completed on timeline.");
        if (jobData) {
          const updatedJobData = {
            ...jobData,
            workflowEvents: {
              ...jobData.workflowEvents,
              fabrication: {
                ...(jobData.workflowEvents?.fabrication || {}),
                isCompleted: true,
                stageStatus: "Complete",
                completedBy: "Fabrication Module (Auto)",
              },
            },
          };
          setCurrentJobContext(updatedJobData);
        }
      } else {
        message.success("Fabrication progress updated");
      }

      await Promise.all([fetchItems(jobId), fetchHistory(jobId)]);
      resetProgressModal();
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to update progress"
      );
    }
  };

  const openCreateModal = () => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    if (!ifcApproved) {
      message.warning("Fabrication cannot start until IFC drawing is approved");
      return;
    }

    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      status: "Pending",
      quantity: 1,
      checklist: [],
    });
    setOpen(true);
  };

  const openEditModal = (record) => {
    setEditingItem(record);

    const selectedChecklist = Object.entries(normalizeChecklist(record.checklist))
      .filter(([, checked]) => checked)
      .map(([key]) => key);

    form.setFieldsValue({
      itemName: record.itemName || "",
      drawingRef: record.drawingRef || "",
      workstation: record.workstation || "",
      assignedTeam: record.assignedTeam || "",
      quantity: record.quantity ?? 1,
      targetDate: record.targetDate ? dayjs(record.targetDate) : null,
      status: record.status || "Pending",
      remarks: record.remarks || "",
      checklist: selectedChecklist,
    });

    setOpen(true);
  };

  const openHoursModal = (record) => {
    setSelectedHoursItem(record);
    hoursForm.setFieldsValue({
      workerName: "",
      role: "",
      hours: 0,
      workDate: dayjs(),
      notes: "",
    });
    setHoursModalOpen(true);
  };

  const onSubmit = async (values) => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    if (!ifcApproved) {
      message.warning("Fabrication cannot start until IFC drawing is approved");
      return;
    }

    const selectedChecklist = Array.isArray(values.checklist) ? values.checklist : [];
    const checklistPayload = FABRICATION_CHECKLIST_OPTIONS.reduce((acc, item) => {
      acc[item.value] = selectedChecklist.includes(item.value);
      return acc;
    }, {});

    const payload = {
      jobId,
      itemName: values.itemName,
      drawingRef: values.drawingRef || "",
      workstation: values.workstation || "",
      assignedTeam: values.assignedTeam || "",
      quantity: Number(values.quantity || 1),
      targetDate: values.targetDate ? values.targetDate.format("YYYY-MM-DD") : "",
      status: values.status || "Pending",
      remarks: values.remarks || "",
      checklist: checklistPayload,
    };

    try {
      if (editingItem?._id) {
        await updateFabricationItem(editingItem._id, payload);
        message.success("Fabrication item updated");
      } else {
        await createFabricationItem(payload);

        await updateJob(jobId, {
          stage: "Fabrication",
          status: "Active",
        });

        const updatedJobData = {
          ...jobData,
          stage: "Fabrication",
          status: "Active",
        };
        setCurrentJobContext(updatedJobData);

        message.success("Fabrication item added");
      }

      await fetchJobs();
      await Promise.all([fetchItems(jobId), fetchDraftingStatus(jobId), fetchHistory(jobId)]);
      resetModal();
    } catch (err) {
      message.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save fabrication item"
      );
    }
  };

  const onAddHours = async (values) => {
    if (!selectedHoursItem?._id) return;

    const existingHours = Array.isArray(selectedHoursItem.hoursLog)
      ? selectedHoursItem.hoursLog
      : [];

    const newEntry = {
      workerName: values.workerName,
      role: values.role || "",
      hours: Number(values.hours || 0),
      workDate: values.workDate
        ? values.workDate.format("YYYY-MM-DD")
        : dayjs().format("YYYY-MM-DD"),
      notes: values.notes || "",
    };

    try {
      await updateFabricationItem(selectedHoursItem._id, {
        hoursLog: [...existingHours, newEntry],
      });
      message.success("Worker hours added");
      await fetchItems(jobId);
      resetHoursModal();
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to add hours log"
      );
    }
  };

  const updateStatus = async (record, newStatus) => {
    if (!isAdmin) {
      message.warning("Only admin can manually override fabrication status");
      return;
    }

    const oldStatus = record.status;

    if (newStatus === "Completed") {
      const progress = checklistPercent(record.checklist);
      if (progress.percent !== 100) {
        message.warning("Complete the fabrication checklist before marking as Completed");
        return;
      }

      if (sumHours(record.hoursLog) <= 0) {
        message.warning("Add actual worker hours before marking as Completed");
        return;
      }
    }

    setItems((prev) =>
      prev.map((x) => (x._id === record._id ? { ...x, status: newStatus } : x))
    );

    try {
      const payload = { status: newStatus };
      if (newStatus === "Completed") {
        payload.progressPercentage = 100;
      }

      await updateFabricationItem(record._id, payload);
      await Promise.all([fetchItems(jobId), fetchHistory(jobId)]);
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
      await deleteFabricationItem(record._id);
      message.success("Fabrication item deleted");
      await fetchItems(jobId);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Delete failed"
      );
    }
  };

  const completeFabrication = async () => {
    if (!jobId) {
      message.warning("Please select a job first");
      return;
    }

    if (!ifcApproved) {
      message.warning("IFC approval is mandatory before fabrication completion");
      return;
    }

    if (!items.length) {
      message.warning("Add at least one fabrication item first");
      return;
    }

    const allCompleted = items.every((item) => item.status === "Completed");
    const allChecklistDone = items.every(
      (item) => checklistPercent(item.checklist).percent === 100
    );
    const allHoursCaptured = items.every((item) => sumHours(item.hoursLog) > 0);

    if (!allCompleted) {
      message.warning("All fabrication items must be marked as Completed first");
      return;
    }

    if (!allChecklistDone) {
      message.warning("Fabrication checklist must be fully completed for all items");
      return;
    }

    if (!allHoursCaptured) {
      message.warning("Actual worker hours must be captured for all fabrication items");
      return;
    }

    try {
      setCompleting(true);

      const fabricationEvent = {
        ...(jobData?.workflowEvents?.fabrication || {}),
        isCompleted: true,
        completedAt: new Date().toISOString(),
        completedBy: "Fabrication Module",
      };

      await updateJob(jobId, {
        stage: "Quality Control",
        status: "Active",
        fabricationSignOff: true,
        workflowEvents: {
          ...jobData?.workflowEvents,
          fabrication: fabricationEvent,
        },
      });

      if (jobData) {
        const updatedJobData = {
          ...jobData,
          stage: "Quality Control",
          status: "Active",
          fabricationSignOff: true,
          workflowEvents: {
            ...jobData.workflowEvents,
            fabrication: fabricationEvent,
          },
        };
        setCurrentJobContext(updatedJobData);
      }

      await fetchJobs();

      message.success("Fabrication completed. Job moved to Quality Control.");
      navigate("/admin/jobs");
    } catch (err) {
      message.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to complete fabrication"
      );
    } finally {
      setCompleting(false);
    }
  };

  const getActionMenuItems = (record) => {
    const items = [];

    if (canUpdateProgress) {
      items.push({
        key: "progress",
        icon: <RiseOutlined />,
        label: "Update Progress",
        onClick: () => openProgressModal(record),
      });
    }

    items.push(
      {
        key: "edit",
        icon: <EditOutlined />,
        label: "Edit",
        onClick: () => openEditModal(record),
      },
      {
        key: "hours",
        icon: <ClockCircleOutlined />,
        label: "Add Hours",
        onClick: () => openHoursModal(record),
      }
    );

    if (isAdmin) {
      items.push({
        key: "delete",
        icon: <DeleteOutlined />,
        label: "Delete",
        danger: true,
        onClick: () => {
          Modal.confirm({
            title: "Delete this item?",
            okText: "Delete",
            okType: "danger",
            onOk: () => onDelete(record),
          });
        },
      });
    }

    return items;
  };

  const renderStatusControl = (record) =>
    isAdmin ? (
      <Select
        value={record.status}
        style={{ width: "100%", minWidth: 120, maxWidth: 160 }}
        onChange={(v) => updateStatus(record, v)}
      >
        <Option value="Pending">Pending</Option>
        <Option value="In Progress">In Progress</Option>
        <Option value="Completed">Completed</Option>
        <Option value="Hold">Hold</Option>
        <Option value="Rework">Rework</Option>
      </Select>
    ) : (
      <Tag color={FAB_STATUS_COLORS[record.status] || "default"}>{record.status}</Tag>
    );

  const renderDrawingCard = (record) => {
    const progress = getDrawingProgress(record);
    const checklist = checklistPercent(record.checklist);

    return (
      <Card
        key={record._id}
        size="small"
        style={{ marginBottom: 12 }}
        title={
          <Space wrap>
            <span>{record.itemName}</span>
            <Tag color={FAB_STATUS_COLORS[record.status] || "default"}>{record.status}</Tag>
          </Space>
        }
        extra={
          <Dropdown menu={{ items: getActionMenuItems(record) }} trigger={["click"]}>
            <Button type="text" icon={<MoreOutlined />} aria-label="Actions" />
          </Dropdown>
        }
      >
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="Drawing Ref">{record.drawingRef || "—"}</Descriptions.Item>
          <Descriptions.Item label="Workstation">{record.workstation || "—"}</Descriptions.Item>
          <Descriptions.Item label="Team">{record.assignedTeam || "—"}</Descriptions.Item>
          <Descriptions.Item label="Target">{record.targetDate || "—"}</Descriptions.Item>
          <Descriptions.Item label="Hours">
            {sumHours(record.hoursLog).toFixed(1)} hrs
          </Descriptions.Item>
        </Descriptions>

        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 4, fontSize: 12, color: "#666" }}>Progress</div>
          <Progress
            percent={progress}
            size="small"
            status={progress >= 100 ? "success" : "active"}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 4, fontSize: 12, color: "#666" }}>Checklist</div>
          <Progress percent={checklist.percent} size="small" />
        </div>

        {isAdmin && (
          <div style={{ marginTop: 12 }}>
            {renderStatusControl(record)}
          </div>
        )}
      </Card>
    );
  };

  const columns = [
    {
      title: "Item",
      dataIndex: "itemName",
      width: 160,
      fixed: isMobile ? undefined : "left",
      ellipsis: true,
    },
    {
      title: "Drawing Ref",
      dataIndex: "drawingRef",
      width: 120,
      ellipsis: true,
      render: (v) => v || "-",
    },
    {
      title: "Workstation",
      dataIndex: "workstation",
      width: 120,
      responsive: ["lg"],
      ellipsis: true,
      render: (v) => v || "-",
    },
    {
      title: "Team",
      dataIndex: "assignedTeam",
      width: 110,
      responsive: ["xl"],
      ellipsis: true,
      render: (v) => v || "-",
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      width: 60,
      responsive: ["md"],
    },
    {
      title: "Target",
      dataIndex: "targetDate",
      width: 110,
      responsive: ["lg"],
      render: (v) => v || "-",
    },
    {
      title: "Progress",
      width: 140,
      render: (_, record) => {
        const progress = getDrawingProgress(record);
        return (
          <Tooltip title={`Updated by ${record.progressUpdatedBy || "—"}`}>
            <Progress
              percent={progress}
              size="small"
              status={progress >= 100 ? "success" : "active"}
            />
          </Tooltip>
        );
      },
    },
    {
      title: "Checklist",
      width: 120,
      responsive: ["md"],
      render: (_, record) => {
        const stats = checklistPercent(record.checklist);
        return (
          <Tooltip title={`${stats.completed}/${stats.total} checklist items completed`}>
            <Progress percent={stats.percent} size="small" />
          </Tooltip>
        );
      },
    },
    {
      title: "Hours",
      width: 90,
      responsive: ["lg"],
      render: (_, record) => (
        <Tag color={sumHours(record.hoursLog) > 0 ? "blue" : "default"}>
          {sumHours(record.hoursLog).toFixed(1)}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 150,
      render: (_, record) => renderStatusControl(record),
    },
    {
      title: "Actions",
      key: "actions",
      width: 72,
      fixed: isMobile ? undefined : "right",
      render: (_, record) => (
        <Dropdown menu={{ items: getActionMenuItems(record) }} trigger={["click"]}>
          <Button type="text" icon={<MoreOutlined />} aria-label="Actions" />
        </Dropdown>
      ),
    },
  ];

  const isEmpty = !loadingItems && items.length === 0;

  return (
    <div className="page-shell">
      <div className="page-shell__header">
        <div>
          <h2 className="page-shell__title">Fabrication</h2>
          <div style={{ color: "#666", marginTop: 4 }}>
            Only jobs with completed Material Purchasing are available here.
          </div>
        </div>

        <Space wrap style={{ justifyContent: isMobile ? "flex-start" : "flex-end" }}>
          <Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>
          <SendForSiteEngineerButton
            jobId={jobId}
            stageKey="fabrication"
            workflowEvents={jobData?.workflowEvents}
            disabled={!items.length}
            disabledReason="Add at least one fabrication item first"
            onSent={(job) => job && setCurrentJobContext(job)}
          />
          <Button type="primary" onClick={openCreateModal} disabled={!ifcApproved}>
            + Add Item
          </Button>
          <Button
            type="primary"
            onClick={completeFabrication}
            loading={completing}
            disabled={!ifcApproved || !isAdmin}
          >
            {isMobile ? "Complete" : "Mark Fabrication Complete"}
          </Button>
        </Space>
      </div>

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
            <div style={{ marginBottom: 8, fontWeight: 500 }}>IFC Gate</div>
            <Tag color={ifcApproved ? "green" : "red"}>
              {ifcApproved ? "IFC Approved" : "IFC Pending"}
            </Tag>
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
            <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2 }}>
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
              <Descriptions.Item label="Drawing / IFC">
                <Tag color={ifcApproved ? "green" : "red"}>
                  {ifcApproved ? "Approved" : "Not Approved"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Drafting Records">
                <Tag color={draftingItems.length > 0 ? "blue" : "default"}>
                  {draftingItems.length}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="QC Gate">
                <Tag
                  color={
                    fabricationSummary.completedItems === items.length && items.length
                      ? "green"
                      : "orange"
                  }
                >
                  {fabricationSummary.completedItems === items.length && items.length
                    ? "Ready for QC"
                    : "Blocked until fabrication sign-off"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 12, fontWeight: 600 }}>Overall Fabrication Progress</div>
            <Progress
              percent={overallProgress}
              status={overallProgress >= 100 ? "success" : "active"}
              strokeWidth={14}
            />
            {overallProgress >= 100 && (
              <div style={{ marginTop: 8, color: "#389e0d" }}>
                All shop drawings reached 100%. Fabrication stage marked complete on job timeline.
              </div>
            )}
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={12} md={6}>
                <Card size="small">
                  <div style={{ color: "#666" }}>Fabrication Items</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {fabricationSummary.totalItems}
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card size="small">
                  <div style={{ color: "#666" }}>Completed Items</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {fabricationSummary.completedItems}
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card size="small">
                  <div style={{ color: "#666" }}>Actual Hours</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {fabricationSummary.totalHours.toFixed(1)}
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card size="small">
                  <div style={{ color: "#666" }}>Checklist Compliance</div>
                  <Tag color={fabricationSummary.checklistCompleted ? "green" : "orange"}>
                    {fabricationSummary.checklistCompleted
                      ? "All Completed"
                      : "Pending"}
                  </Tag>
                </Card>
              </Col>
            </Row>
          </Card>

          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key);
              if (key === "history") fetchHistory(jobId);
            }}
            items={[
              {
                key: "drawings",
                label: "Shop Drawings",
                children: isEmpty ? (
                  <Card>
                    <Empty description="No fabrication items currently for this job." />
                  </Card>
                ) : isMobile ? (
                  <div>{items.map((record) => renderDrawingCard(record))}</div>
                ) : (
                  <div className="table-responsive-wrap">
                    <Table
                      columns={columns}
                      dataSource={items}
                      rowKey="_id"
                      loading={loadingItems}
                      pagination={{ pageSize: 10, showSizeChanger: false }}
                      scroll={{ x: 1100 }}
                      size="middle"
                    />
                  </div>
                ),
              },
              {
                key: "history",
                label: "Activity History",
                children: (
                  <Card loading={loadingHistory}>
                    {history.length === 0 ? (
                      <Empty description="No fabrication progress history yet." />
                    ) : (
                      <Timeline
                        items={history.map((log) => ({
                          children: (
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {(log.fabricationId?.itemName || log.fabricationId?.drawingRef || "Drawing")}{" "}
                                — {log.oldPercentage}% → {log.newPercentage}%
                              </div>
                              <div style={{ color: "#666", fontSize: 12 }}>
                                {log.updatedBy || "—"} ·{" "}
                                {log.timestamp
                                  ? new Date(log.timestamp).toLocaleString()
                                  : "—"}
                              </div>
                              {log.remarks ? (
                                <div style={{ marginTop: 4 }}>{log.remarks}</div>
                              ) : null}
                            </div>
                          ),
                        }))}
                      />
                    )}
                  </Card>
                ),
              },
            ]}
          />
        </>
      )}

      <Modal
        title={editingItem ? "Edit Fabrication Item" : "Add Fabrication Item"}
        open={open}
        onCancel={resetModal}
        onOk={() => form.submit()}
        okText={editingItem ? "Update" : "Save"}
        width={isMobile ? "100%" : 900}
        style={isMobile ? { top: 16, maxWidth: "calc(100vw - 32px)" } : undefined}
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Row gutter={[16,16]} wrap>
            <Col xs={24} sm={24} md={12} lg={12}>
              <Form.Item
                name="itemName"
                label="Item Name"
                rules={[{ required: true, message: "Item name is required" }]}
              >
                <Input placeholder="e.g. Handrail Frame" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={24} md={12} lg={12}>
              <Form.Item
                name="drawingRef"
                label="IFC Drawing Reference"
                rules={[{ required: true, message: "Drawing reference is required" }]}
              >
                <Input placeholder="e.g. IFC-02 / DRW-01" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={24} md={12} lg={12}>
              <Form.Item name="workstation" label="Workstation / Machine">
                <Input placeholder="e.g. Cutting / Welding / Polish" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={24} md={12} lg={12}>
              <Form.Item name="assignedTeam" label="Assigned Team">
                <Input placeholder="e.g. Fabrication Crew A" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={24} md={12} lg={12}>
              <Form.Item
                name="quantity"
                label="Quantity"
                rules={[{ required: true, message: "Quantity is required" }]}
              >
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={24} md={12} lg={12}>
              <Form.Item name="targetDate" label="Target Date">
                <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={24} md={12} lg={12}>
              <Form.Item name="status" label="Status">
                <Select placeholder="Select status">
                  <Option value="Pending">Pending</Option>
                  <Option value="In Progress">In Progress</Option>
                  <Option value="Completed">Completed</Option>
                  <Option value="Hold">Hold</Option>
                  <Option value="Rework">Rework</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ marginTop: 0 }}>Fabrication Checklist</Divider>

          <Form.Item
            name="checklist"
            rules={[
              {
                validator: (_, value) => {
                  if (Array.isArray(value) && value.length > 0) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("Select at least one checklist item")
                  );
                },
              },
            ]}
          >
            <Checkbox.Group style={{ width: "100%" }}>
              <Row gutter={[8, 8]}>
                {FABRICATION_CHECKLIST_OPTIONS.map((item) => (
                  <Col xs={24} md={12} key={item.value}>
                    <Checkbox value={item.value}>{item.label}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={3} placeholder="Optional notes..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Update Progress${
          selectedProgressItem?.drawingRef
            ? ` - ${selectedProgressItem.drawingRef}`
            : selectedProgressItem?.itemName
              ? ` - ${selectedProgressItem.itemName}`
              : ""
        }`}
        open={progressModalOpen}
        onCancel={resetProgressModal}
        onOk={() => progressForm.submit()}
        okText="Save Progress"
      >
        <Form form={progressForm} layout="vertical" onFinish={onUpdateProgress}>
          <Form.Item
            name="progressPercentage"
            label="Progress (%)"
            rules={[{ required: true, message: "Progress percentage is required" }]}
          >
            <InputNumber min={0} max={100} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={3} placeholder="Notes about this progress update..." />
          </Form.Item>

          {selectedProgressItem?._id ? (
            <Form.Item label="Photos (required for 100%)">
              <Upload
                multiple
                beforeUpload={() => false}
                onChange={async (info) => {
                  const files = info.fileList
                    .map((f) => f.originFileObj)
                    .filter(Boolean);
                  if (!files.length) return;
                  try {
                    await uploadFabricationFiles(selectedProgressItem._id, files);
                    message.success("Photos uploaded");
                    await fetchItems(jobId);
                    const refreshed = (await getFabricationItems(jobId))?.items?.find(
                      (i) => i._id === selectedProgressItem._id
                    );
                    if (refreshed) setSelectedProgressItem(refreshed);
                  } catch (err) {
                    message.error(err?.response?.data?.message || "Upload failed");
                  }
                }}
              >
                <Button icon={<UploadOutlined />}>Upload photos</Button>
              </Upload>
              {(selectedProgressItem.photoUrls || []).length > 0 ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                  {selectedProgressItem.photoUrls.length} file(s) attached
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, color: "#cf1322" }}>
                  No photos yet — upload before setting 100%
                </div>
              )}
            </Form.Item>
          ) : null}
        </Form>
      </Modal>

      <Modal
        title={`Add Actual Hours${
          selectedHoursItem?.itemName ? ` - ${selectedHoursItem.itemName}` : ""
        }`}
        open={hoursModalOpen}
        onCancel={resetHoursModal}
        onOk={() => hoursForm.submit()}
        okText="Save Hours"
      >
        <Form form={hoursForm} layout="vertical" onFinish={onAddHours}>
          <Form.Item
            name="workerName"
            label="Worker Name"
            rules={[{ required: true, message: "Worker name is required" }]}
          >
            <Input placeholder="e.g. Ravi Kumar" />
          </Form.Item>

          <Form.Item name="role" label="Role">
            <Input placeholder="e.g. Welder / Fitter / Polisher" />
          </Form.Item>

          <Form.Item
            name="hours"
            label="Hours"
            rules={[{ required: true, message: "Hours are required" }]}
          >
            <InputNumber min={0} step={0.5} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="workDate"
            label="Work Date"
            rules={[{ required: true, message: "Work date is required" }]}
          >
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Optional notes..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}