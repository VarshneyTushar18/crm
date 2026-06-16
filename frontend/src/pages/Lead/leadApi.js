import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const API = `${API_BASE_URL}/lead`;

// ✅ helper: attach token in headers
const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getLeads = async () => {
  const res = await axios.get(`${API}/list`, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || [];
};

export const getLead = async (id) => {
  const res = await axios.get(`${API}/read/${id}`, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};

export const addLeadInteraction = async (id, payload) => {
  const res = await axios.post(`${API}/${id}/interaction`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data;
};

export const createLead = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data;
};

export const updateLead = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data;
};

export const deleteLead = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, {
    headers: { ...authHeaders() },
  });
  return res.data;
};

// ❌ Removed: createJobFromLead (Job will be created ONLY when Quote Approved)