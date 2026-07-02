import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const API = `${API_BASE_URL}/job`;

const authHeaders = () => {
  const token = window.localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getJobs = async () => {
  const res = await axios.get(`${API}/list`, { headers: { ...authHeaders() } });
  return res.data?.result || [];
};

export const createJob = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, { headers: { ...authHeaders() } });
  return res.data;
};

export const createJobFromLead = async (leadId) => {
  const res = await axios.post(`${API_BASE_URL}/lead/convert-to-job/${leadId}`, {}, {
    headers: { ...authHeaders() },
  });
  return res.data;
};

export const deleteJob = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, { headers: { ...authHeaders() } });
  return res.data;
};

export const updateJob = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data;
};

export const updateJobStage = async (id, stageName, payload) => {
  const res = await axios.patch(`${API}/stage/${id}/${stageName}`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data;
};

export const getJobById = async (id) => {
  const res = await axios.get(`${API}/read/${id}`, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};
