import axios from "axios";
import { API_BASE_URL, multipartAuthHeaders } from "@/config/serverApiConfig";

const API = `${API_BASE_URL}/scheduling`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getScheduleByJob = async (jobId) => {
  const res = await axios.get(`${API}/list/${jobId}`, { headers: authHeaders() });
  return res.data?.result || [];
};

export const getScheduleCalendar = async (params = {}) => {
  const res = await axios.get(`${API}/calendar`, {
    headers: authHeaders(),
    params,
  });
  return res.data?.result || [];
};

export const createScheduleAssignment = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, { headers: authHeaders() });
  return res.data;
};

export const updateScheduleAssignment = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, { headers: authHeaders() });
  return res.data;
};

export const deleteScheduleAssignment = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, { headers: authHeaders() });
  return res.data;
};

export const uploadScheduleAttachments = async (id, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await axios.post(`${API}/upload/${id}`, formData, {
    headers: multipartAuthHeaders(),
  });
  return res.data?.result || null;
};

export const getSiteEngineerReviews = async (jobId, params = {}) => {
  const res = await axios.get(`${API_BASE_URL}/site-engineer/list/${jobId}`, {
    headers: authHeaders(),
    params,
  });
  return res.data?.result || [];
};

export const getSiteEngineerAllReviews = async (params = {}) => {
  const res = await axios.get(`${API_BASE_URL}/site-engineer/reviews`, {
    headers: authHeaders(),
    params,
  });
  return res.data?.result || [];
};

export const getSiteEngineerSummary = async () => {
  const res = await axios.get(`${API_BASE_URL}/site-engineer/summary`, {
    headers: authHeaders(),
  });
  return res.data?.result || null;
};

export const updateSiteEngineerReviewStatus = async (id, status, comments = "") => {
  const res = await axios.patch(
    `${API_BASE_URL}/site-engineer/status/${id}`,
    { status, comments },
    { headers: authHeaders() }
  );
  return res.data;
};

export const getSiteEngineerPending = async () => {
  const res = await axios.get(`${API_BASE_URL}/site-engineer/pending`, {
    headers: authHeaders(),
  });
  return res.data?.result || [];
};

export const approveSiteEngineerReview = async (id, comments) => {
  const res = await axios.post(
    `${API_BASE_URL}/site-engineer/approve/${id}`,
    { comments },
    { headers: authHeaders() }
  );
  return res.data;
};

export const rejectSiteEngineerReview = async (id, comments) => {
  const res = await axios.post(
    `${API_BASE_URL}/site-engineer/reject/${id}`,
    { comments },
    { headers: authHeaders() }
  );
  return res.data;
};

export const ensureSiteEngineerReview = async (draftingId) => {
  const res = await axios.post(
    `${API_BASE_URL}/site-engineer/ensure/${draftingId}`,
    {},
    { headers: authHeaders() }
  );
  return res.data;
};

export const sendForSiteEngineerApproval = async (jobId, stageKey) => {
  const res = await axios.post(
    `${API_BASE_URL}/site-engineer/send/${jobId}`,
    { stageKey },
    { headers: authHeaders() }
  );
  return res.data;
};

export const getNotifications = async () => {
  const res = await axios.get(`${API_BASE_URL}/notifications/list`, {
    headers: authHeaders(),
  });
  return res.data?.result || { items: [], unreadCount: 0 };
};

export const markNotificationRead = async (id) => {
  const res = await axios.patch(`${API_BASE_URL}/notifications/read/${id}`, null, {
    headers: authHeaders(),
  });
  return res.data;
};

export const markAllNotificationsRead = async () => {
  const res = await axios.patch(`${API_BASE_URL}/notifications/read-all`, null, {
    headers: authHeaders(),
  });
  return res.data;
};

export const getCustomerFinancialSummary = async () => {
  const res = await axios.get(`${API_BASE_URL}/customer/financial-summary`, {
    headers: authHeaders(),
  });
  return res.data?.result;
};

export const getAdminDashboardOverview = async (params = {}) => {
  const res = await axios.get(`${API_BASE_URL}/dashboard/admin-overview`, {
    headers: authHeaders(),
    params,
  });
  return res.data?.result || null;
};

export const getJobComments = async (jobId) => {
  const res = await axios.get(`${API_BASE_URL}/job-comments/list/${jobId}`, {
    headers: authHeaders(),
  });
  return res.data?.result || [];
};

export const createJobComment = async (jobId, message, files = []) => {
  const fd = new FormData();
  fd.append("message", message);
  (files || []).forEach((file) => fd.append("files", file));

  const res = await axios.post(`${API_BASE_URL}/job-comments/create/${jobId}`, fd, {
    headers: multipartAuthHeaders(),
  });
  return res.data;
};

export const getWorkerAssignedJobs = async () => {
  const res = await axios.get(`${API_BASE_URL}/job-comments/my-jobs`, {
    headers: authHeaders(),
  });
  return res.data?.result || [];
};

export const markPowderCoatingComplete = async (jobId, batchRef = "") => {
  const res = await axios.post(
    `${API_BASE_URL}/powder-coating/complete/${jobId}`,
    { batchRef },
    { headers: authHeaders() }
  );
  return res.data;
};
