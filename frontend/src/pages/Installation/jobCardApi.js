import axios from "axios";
import { API_BASE_URL, multipartAuthHeaders } from "@/config/serverApiConfig";

const API = `${API_BASE_URL}/job-card`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getJobCardsByJob = async (jobId) => {
  const res = await axios.get(`${API}/list/${jobId}`, {
    headers: authHeaders(),
  });
  return res.data?.result || [];
};

export const getMyJobCards = async (jobId) => {
  const res = await axios.get(`${API}/my`, {
    headers: authHeaders(),
    params: jobId ? { jobId } : {},
  });
  return res.data?.result || [];
};

export const createJobCard = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: authHeaders(),
  });
  return res.data?.result || null;
};

export const generateJobCardsFromInstallation = async (jobId) => {
  const res = await axios.post(`${API}/generate-from-installation/${jobId}`, {}, {
    headers: authHeaders(),
  });
  return res.data;
};

export const updateJobCard = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, {
    headers: authHeaders(),
  });
  return res.data?.result || null;
};

export const executeJobCard = async (id, payload) => {
  const res = await axios.patch(`${API}/execute/${id}`, payload, {
    headers: authHeaders(),
  });
  return res.data?.result || null;
};

export const deleteJobCard = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, {
    headers: authHeaders(),
  });
  return res.data?.result || null;
};

export const uploadJobCardFiles = async (id, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await axios.post(`${API}/upload/${id}`, formData, {
    headers: multipartAuthHeaders(),
  });
  return res.data?.result || null;
};
