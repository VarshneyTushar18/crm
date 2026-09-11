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
  Alert,
} from "antd";
import {
  ArrowLeftOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useJob } from "../../context/JobContext";
import { getJobs, updateJob } from "../Jobs/jobApi";
import { isStageComplete } from "@/config/workflowConfig";
import { getEmployees } from "../Employee/employeeApi";
import {
  getInstallationItems,
  createInstallationItem,
  updateInstallationItem,
  deleteInstallationItem,
  reorderInstallationSequence,
  getInstallationSummary,
  saveInstallationSummary,
  markInstallationComplete,
  finalizeJobCompletion,
  uploadInstallationActivityFiles,
} from "./installationApi";
import { getOpenDefectSnagCount } from "../DefectsSnags/defectSnagApi";
import {
  getJobCardsByJob,
  createJobCard,
  updateJobCard,
  deleteJobCard,
  generateJobCardsFromInstallation,
} from "./jobCardApi";
import SendForSiteEngineerButton from "@/components/SendForSiteEngineerButton";
import { buildFileUrl } from "@/config/serverApiConfig";

const { Option } = Select;
const { TextArea } = Input;

const normFile = (e) => {
  if (Array.isArray(e)) {
    return e;
  }
  return e?.fileList;
};

const ACTIVITY_STATUSES = ["Pending", "In Progress", "Completed", "Hold", "Snag"];
const ACTIVITY_STATUS_LABELS = {
  Pending: "Pending",
  "In Progress": "In Progress",
  Completed: "Completed",
  Hold: "Hold",
  Snag: "Defect / Snag",
};
const JOB_CARD_STATUSES = ["Pending", "Assigned", "In Progress", "Completed", "On Hold"];

const JOB_CARD_STATUS_COLORS = {
  Pending: "default",
  Assigned: "blue",
  "In Progress": "processing",
  Completed: "green",
  "On Hold": "orange",
};

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

const sortBySequence = (list = []) =>
  [...list].sort((a, b) => {
    const orderA = Number(a?.sequenceOrder || 0);
    const orderB = Number(b?.sequenceOrder || 0);
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0);
  });

const isActivityLocked = (record, allItems = []) => {
  if (!record || record.status === "Completed") return false;
  const order = Number(record.sequenceOrder || 0);
  return sortBySequence(allItems).some(
    (item) =>
      String(item._id) !== String(record._id) &&
      Number(item.sequenceOrder || 0) < order &&
      item.status !== "Completed"
  );
};

function sumHours(hoursLog = []) {
  return (Array.isArray(hoursLog) ? hoursLog : []).reduce(
    (sum, entry) => sum + Number(entry?.hours || 0),
    0
  );
}

export default function Installation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
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
  const [jobCards, setJobCards] = useState([]);
  const [jobCardModalOpen, setJobCardModalOpen] = useState(false);
  const [editingJobCard, setEditingJobCard] = useState(null);
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [selectedHoursItem, setSelectedHoursItem] = useState(null);
  const [openDefectCount, setOpenDefectCount] = useState(0);

  const [activityForm] = Form.useForm();
  const [summaryForm] = Form.useForm();
  const [completionForm] = Form.useForm();
  const [jobCardForm] = Form.useForm();
  const [hoursForm] = Form.useForm();

  useEffect(() => {
    loadJobs();
    loadEmployees();
  }, []);

  useEffect(() => {
    if (!jobs.length) return;

    const queryJobId = searchParams.get("jobId");
    const stateJob = location?.state?.job || location?.state?.fromJob;

    if (queryJobId) {
      const found = jobs.find((j) => j._id === queryJobId);
      if (found) {
        setSelectedJob(found);
        setActiveJobId?.(found._id);
        return;
      }
    }

    if (stateJob?._id) {
      setSelectedJob(stateJob);
      setActiveJobId?.(stateJob._id);
      return;
    }

    if (activeJobId) {
      const found = jobs.find((j) => j._id === activeJobId);
      if (found) setSelectedJob(found);
    }
  }, [jobs, activeJobId, location?.state, searchParams, setActiveJobId]);

  useEffect(() => {
    if (selectedJob?._id) {
      loadInstallationData(selectedJob._id);
    } else {
      setItems([]);
      setJobCards([]);
      setOpenDefectCount(0);
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

      const [activityData, summaryData, cardData, openDefects] = await Promise.all([
        getInstallationItems(jobId),
        getInstallationSummary(jobId).catch(() => ({})),
        getJobCardsByJob(jobId).catch(() => []),
        getOpenDefectSnagCount(jobId).catch(() => ({ count: 0 })),
      ]);

      const normalizedItems = Array.isArray(activityData) ? activityData : [];
      setItems(normalizedItems);
      setJobCards(Array.isArray(cardData) ? cardData : []);
      setOpenDefectCount(Number(openDefects?.count || 0));

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
            isStageComplete(job, "finishing") ||
            isStageComplete(job, "powderCoatingQc") ||
            isStageComplete(job, "fabricationQc") ||
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

  const sortedItems = useMemo(() => sortBySequence(items), [items]);

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
    if (openDefectCount > 0) return false;
    return items.every((item) => item.status === "Completed");
  }, [items, selectedJob, openDefectCount]);

  const canFinalizeSignOff = useMemo(() => {
    if (!selectedJob?._id) return false;
    if (openDefectCount > 0) return false;
    return true;
  }, [selectedJob, openDefectCount]);

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
      message.error(err?.response?.data?.message || "Failed to save installation activity");
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

  const openCreateJobCardModal = () => {
    if (!selectedJob?._id) {
      message.warning("Please select a job first");
      return;
    }
    setEditingJobCard(null);
    jobCardForm.resetFields();
    jobCardForm.setFieldsValue({
      status: "Pending",
      expectedHours: 0,
      assignedInstallers: [],
    });
    setJobCardModalOpen(true);
  };

  const openEditJobCardModal = (record) => {
    setEditingJobCard(record);
    jobCardForm.setFieldsValue({
      title: record.title || "",
      description: record.description || "",
      installationId: record.installationId?._id || record.installationId || undefined,
      locationArea: record.locationArea || "",
      assignedInstallers: record.assignedInstallers || [],
      siteAccessNotes: record.siteAccessNotes || "",
      toolsRequired: record.toolsRequired || "",
      materialsRequired: record.materialsRequired || "",
      completionCriteria: record.completionCriteria || "",
      plannedStart: record.plannedStart ? dayjs(record.plannedStart) : null,
      plannedEnd: record.plannedEnd ? dayjs(record.plannedEnd) : null,
      expectedHours: record.expectedHours || 0,
      status: record.status || "Pending",
      remarks: record.remarks || "",
      ppeVerified: !!record.safetyChecklist?.ppeVerified,
      siteBriefed: !!record.safetyChecklist?.siteBriefed,
      permitsChecked: !!record.safetyChecklist?.permitsChecked,
      equipmentInspected: !!record.safetyChecklist?.equipmentInspected,
    });
    setJobCardModalOpen(true);
  };

  const closeJobCardModal = () => {
    setJobCardModalOpen(false);
    setEditingJobCard(null);
    jobCardForm.resetFields();
  };

  const handleSaveJobCard = async () => {
    try {
      const values = await jobCardForm.validateFields();
      if (!selectedJob?._id) return;

      setSaving(true);
      const payload = {
        jobId: selectedJob._id,
        installationId: values.installationId || null,
        title: values.title,
        description: values.description || "",
        locationArea: values.locationArea || "",
        assignedInstallers: values.assignedInstallers || [],
        siteAccessNotes: values.siteAccessNotes || "",
        toolsRequired: values.toolsRequired || "",
        materialsRequired: values.materialsRequired || "",
        completionCriteria: values.completionCriteria || "",
        plannedStart: values.plannedStart ? values.plannedStart.format("YYYY-MM-DD") : "",
        plannedEnd: values.plannedEnd ? values.plannedEnd.format("YYYY-MM-DD") : "",
        expectedHours: Number(values.expectedHours || 0),
        status: values.status || "Pending",
        remarks: values.remarks || "",
        safetyChecklist: {
          ppeVerified: !!values.ppeVerified,
          siteBriefed: !!values.siteBriefed,
          permitsChecked: !!values.permitsChecked,
          equipmentInspected: !!values.equipmentInspected,
        },
      };

      if (editingJobCard?._id) {
        await updateJobCard(editingJobCard._id, payload);
        message.success("Job card updated");
      } else {
        await createJobCard(payload);
        message.success("Job card created");
      }

      closeJobCardModal();
      await loadInstallationData(selectedJob._id);
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || "Failed to save job card");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateJobCards = async () => {
    if (!selectedJob?._id) return;
    try {
      setSaving(true);
      const res = await generateJobCardsFromInstallation(selectedJob._id);
      message.success(res?.message || "Job cards generated");
      await loadInstallationData(selectedJob._id);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to generate job cards");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJobCard = async (id) => {
    try {
      await deleteJobCard(id);
      message.success("Job card deleted");
      if (selectedJob?._id) await loadInstallationData(selectedJob._id);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to delete job card");
    }
  };

  const openHoursModal = (record) => {
    setSelectedHoursItem(record);
    hoursForm.resetFields();
    hoursForm.setFieldsValue({
      workDate: dayjs(),
      role: "Installer",
    });
    setHoursModalOpen(true);
  };

  const resetHoursModal = () => {
    setHoursModalOpen(false);
    setSelectedHoursItem(null);
    hoursForm.resetFields();
  };

  const onAddHours = async (values) => {
    if (!selectedHoursItem?._id || !selectedJob?._id) return;

    const existingHours = Array.isArray(selectedHoursItem.hoursLog)
      ? selectedHoursItem.hoursLog
      : [];

    const newEntry = {
      workerName: values.workerName,
      role: values.role || "Installer",
      hours: Number(values.hours || 0),
      workDate: values.workDate
        ? values.workDate.format("YYYY-MM-DD")
        : dayjs().format("YYYY-MM-DD"),
      notes: values.notes || "",
    };

    try {
      setSaving(true);
      await updateInstallationItem(selectedHoursItem._id, {
        hoursLog: [...existingHours, newEntry],
      });
      message.success("Worker hours added");
      resetHoursModal();
      await loadInstallationData(selectedJob._id);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to add hours");
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStep = async (record, direction) => {
    if (!selectedJob?._id) return;

    const ordered = sortBySequence(sortedItems);
    const currentIndex = ordered.findIndex((item) => item._id === record._id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const reordered = [...ordered];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];

    try {
      setSaving(true);
      await reorderInstallationSequence(
        selectedJob._id,
        reordered.map((item) => item._id)
      );
      message.success("Installation sequence updated");
      await loadInstallationData(selectedJob._id);
    } catch (err) {
      console.error(err);
      message.error(err?.response?.data?.message || "Failed to reorder steps");
    } finally {
      setSaving(false);
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
      if (openDefectCount > 0) {
        message.warning(
          `Clear all defects & snags before completion (${openDefectCount} still open)`
        );
        return;
      }
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
      message.error(err?.response?.data?.message || "Failed to mark installation complete");
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

      if (openDefectCount > 0) {
        message.warning(
          `Clear all defects & snags before sign-off (${openDefectCount} still open)`
        );
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
      title: "Step",
      dataIndex: "sequenceOrder",
      key: "sequenceOrder",
      width: 70,
      render: (value) => value || "—",
    },
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
      title: "Worker Hours",
      width: 120,
      render: (_, record) => (
        <Tag color={sumHours(record.hoursLog) > 0 ? "blue" : "default"}>
          {sumHours(record.hoursLog).toFixed(1)}h
        </Tag>
      ),
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
      width: 150,
      render: (status, record) => (
        <Space direction="vertical" size={4}>
          <Tag color={STATUS_COLORS[status] || "default"}>
            {ACTIVITY_STATUS_LABELS[status] || status || "—"}
          </Tag>
          {isActivityLocked(record, sortedItems) ? (
            <Tag color="orange">Awaiting prior step</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Defect / Snag",
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
      width: 280,
      render: (_, record) => {
        const stepIndex = sortedItems.findIndex((item) => item._id === record._id);
        return (
          <Space wrap>
            <Button size="small" onClick={() => openHoursModal(record)}>
              Add Hours
            </Button>
            <Button
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={stepIndex <= 0 || saving}
              onClick={() => handleMoveStep(record, "up")}
            />
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={stepIndex >= sortedItems.length - 1 || saving}
              onClick={() => handleMoveStep(record, "down")}
            />
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
        );
      },
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

                <SendForSiteEngineerButton
                  jobId={selectedJob?._id}
                  stageKey="installation"
                  workflowEvents={selectedJob?.workflowEvents}
                  disabled={!items.length}
                  disabledReason="Add at least one installation activity first"
                  onSent={(job) => job && setSelectedJob(job)}
                />

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
                  disabled={!selectedJob || !canFinalizeSignOff}
                >
                  Job Completion & Customer Sign-Off
                </Button>
              </Space>
            }
          >
            <div style={{ color: "#666" }}>
              Only QC-approved / Finishing-completed jobs are available here.
              Installation activities run in sequence — complete each step before starting the next.
              {openDefectCount > 0 ? (
                <Alert
                  style={{ marginTop: 12 }}
                  type="warning"
                  showIcon
                  message={`${openDefectCount} open defect(s) / snag(s) — clear them under Execution → Defects & Snags before completion / sign-off.`}
                />
              ) : null}
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
                  {ACTIVITY_STATUS_LABELS[currentInstallationStatus] ||
                    currentInstallationStatus}
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
                dataSource={sortedItems}
                columns={columns}
                scroll={{ x: 1900 }}
                pagination={{ pageSize: 10 }}
              />
            </Spin>
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title="Installer Job Cards"
            extra={
              <Space wrap>
                <Button onClick={handleGenerateJobCards} disabled={!selectedJob || !sortedItems.length} loading={saving}>
                  Generate from Activities
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateJobCardModal} disabled={!selectedJob}>
                  Add Job Card
                </Button>
              </Space>
            }
          >
            {!jobCards.length ? (
              <Empty description="No installer job cards yet. Generate from activities or add manually." />
            ) : (
              <Table
                rowKey="_id"
                dataSource={jobCards}
                pagination={{ pageSize: 8 }}
                scroll={{ x: 1400 }}
                columns={[
                  { title: "Card No.", dataIndex: "cardNumber", width: 150 },
                  { title: "Title", dataIndex: "title", width: 180 },
                  {
                    title: "Step",
                    width: 70,
                    render: (_, row) => row.sequenceOrder || row.installationId?.sequenceOrder || "—",
                  },
                  {
                    title: "Installers",
                    dataIndex: "assignedInstallers",
                    width: 180,
                    render: (v) => (Array.isArray(v) && v.length ? v.join(", ") : "—"),
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    width: 120,
                    render: (status) => (
                      <Tag color={JOB_CARD_STATUS_COLORS[status] || "default"}>{status}</Tag>
                    ),
                  },
                  {
                    title: "Hours",
                    width: 110,
                    render: (_, row) => `${Number(row.actualHours || 0)} / ${Number(row.expectedHours || 0)}`,
                  },
                  {
                    title: "Safety",
                    width: 100,
                    render: (_, row) => {
                      const checks = row.safetyChecklist || {};
                      const done = ["ppeVerified", "siteBriefed", "permitsChecked", "equipmentInspected"].filter(
                        (k) => checks[k]
                      ).length;
                      return <Tag color={done === 4 ? "green" : "orange"}>{done}/4</Tag>;
                    },
                  },
                  {
                    title: "Actions",
                    width: 150,
                    render: (_, row) => (
                      <Space>
                        <Button size="small" onClick={() => openEditJobCardModal(row)}>Edit</Button>
                        <Popconfirm title="Delete this job card?" onConfirm={() => handleDeleteJobCard(row._id)}>
                          <Button size="small" danger>Delete</Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            )}
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
          {editingItem && isActivityLocked(editingItem, sortedItems) ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Earlier installation steps must be completed before this activity can start."
            />
          ) : null}
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
                    <Option
                      key={status}
                      value={status}
                      disabled={
                        !!editingItem &&
                        isActivityLocked(editingItem, sortedItems) &&
                        ["In Progress", "Completed"].includes(status)
                      }
                    >
                      {ACTIVITY_STATUS_LABELS[status] || status}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Defect / Snag" name="snagIssue">
                <Input placeholder="Enter defect / snag details if any" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Remarks" name="remarks">
                <TextArea rows={4} placeholder="Enter work remarks" />
              </Form.Item>
            </Col>

            {editingItem?._id ? (
              <Col xs={24}>
                <Form.Item label="Photos / PDF (required to mark Completed)">
                  <Upload
                    multiple
                    accept="image/*,.pdf,.doc,.docx,video/*"
                    customRequest={async ({ file, onSuccess, onError }) => {
                      try {
                        const updated = await uploadInstallationActivityFiles(
                          editingItem._id,
                          [file]
                        );
                        setEditingItem(updated);
                        message.success("File uploaded");
                        if (selectedJob?._id) {
                          await loadInstallationData(selectedJob._id);
                        }
                        onSuccess?.(null, file);
                      } catch (err) {
                        message.error(err?.response?.data?.message || "Upload failed");
                        onError?.(err);
                      }
                    }}
                  >
                    <Button icon={<UploadOutlined />}>Upload files</Button>
                  </Upload>
                  {(editingItem.photoUrls || []).length > 0 ? (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      {(editingItem.photoUrls || []).map((url) => (
                        <div key={url}>
                          <a href={buildFileUrl(url)} target="_blank" rel="noreferrer">
                            {url.split("/").pop()}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#cf1322" }}>
                      No files yet — upload before marking activity complete
                    </div>
                  )}
                </Form.Item>
              </Col>
            ) : null}
          </Row>
        </Form>
      </Modal>

      <Modal
        open={hoursModalOpen}
        title={
          selectedHoursItem
            ? `Add Hours — ${selectedHoursItem.activityName}`
            : "Add Worker Hours"
        }
        onCancel={resetHoursModal}
        onOk={() => hoursForm.submit()}
        confirmLoading={saving}
        okText="Save Hours"
      >
        <Form form={hoursForm} layout="vertical" onFinish={onAddHours}>
          <Form.Item
            name="workerName"
            label="Worker Name"
            rules={[{ required: true, message: "Worker name is required" }]}
          >
            <Select showSearch placeholder="Select worker" optionFilterProp="children">
              {employees.map((emp) => (
                <Option key={emp._id} value={emp.name}>
                  {emp.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="role" label="Role">
            <Input placeholder="Installer" />
          </Form.Item>
          <Form.Item
            name="hours"
            label="Hours"
            rules={[{ required: true, message: "Hours are required" }]}
          >
            <InputNumber min={0} step={0.5} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="workDate" label="Work Date">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={jobCardModalOpen}
        title={editingJobCard ? "Edit Installer Job Card" : "Add Installer Job Card"}
        onCancel={closeJobCardModal}
        onOk={handleSaveJobCard}
        confirmLoading={saving}
        width={900}
        okText="Save"
      >
        <Form form={jobCardForm} layout="vertical">
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }]}>
                <Input placeholder="e.g. Level 1 balustrade install" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="installationId" label="Linked Installation Step">
                <Select allowClear placeholder="Optional link to activity">
                  {sortedItems.map((item) => (
                    <Option key={item._id} value={item._id}>
                      Step {item.sequenceOrder}: {item.activityName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="locationArea" label="Location / Area">
                <Input placeholder="Site area" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="assignedInstallers" label="Assigned Installers">
                <Select mode="multiple" placeholder="Select installers">
                  {employees.map((emp) => (
                    <Option key={emp._id} value={emp.name}>
                      {emp.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="plannedStart" label="Planned Start">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="plannedEnd" label="Planned End">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="expectedHours" label="Expected Hours">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="status" label="Status">
                <Select>
                  {JOB_CARD_STATUSES.map((status) => (
                    <Option key={status} value={status}>{status}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="siteAccessNotes" label="Site Access Notes">
                <TextArea rows={2} placeholder="Access, parking, induction requirements..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="toolsRequired" label="Tools Required">
                <TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="materialsRequired" label="Materials Required">
                <TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="completionCriteria" label="Completion Criteria">
                <TextArea rows={2} placeholder="What defines done for this card?" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Divider orientation="left">Safety Checklist</Divider>
            </Col>
            <Col xs={12} md={6}><Form.Item name="ppeVerified" valuePropName="checked"><Checkbox>PPE verified</Checkbox></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="siteBriefed" valuePropName="checked"><Checkbox>Site briefed</Checkbox></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="permitsChecked" valuePropName="checked"><Checkbox>Permits checked</Checkbox></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="equipmentInspected" valuePropName="checked"><Checkbox>Equipment inspected</Checkbox></Form.Item></Col>
            <Col xs={24}>
              <Form.Item name="remarks" label="Remarks">
                <TextArea rows={2} />
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