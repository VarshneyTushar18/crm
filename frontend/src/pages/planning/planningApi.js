import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const API = `${API_BASE_URL}/planning`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getPlanningTasks = async (jobId) => {
  const res = await axios.get(`${API}/list/${jobId}`, {
    headers: authHeaders(),
  });
  return res.data?.result || [];
};

export const createPlanningTask = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: authHeaders(),
  });
  return res.data?.result || null;
};

export const updatePlanningTask = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, {
    headers: authHeaders(),
  });
  return res.data?.result || null;
};

export const deletePlanningTask = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, {
    headers: authHeaders(),
  });
  return res.data?.result || null;
};