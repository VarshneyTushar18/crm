import axios from "axios";
import { API_BASE_URL } from "@/config/serverApiConfig";

const API = `${API_BASE_URL}/leave`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getLeaves = async (params = {}) => {
  const res = await axios.get(`${API}/list`, { headers: authHeaders(), params });
  return res.data?.result || [];
};

export const createLeave = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, { headers: authHeaders() });
  return res.data?.result;
};

export const approveLeave = async (id) => {
  const res = await axios.post(`${API}/approve/${id}`, {}, { headers: authHeaders() });
  return res.data;
};

export const rejectLeave = async (id) => {
  const res = await axios.post(`${API}/reject/${id}`, {}, { headers: authHeaders() });
  return res.data;
};

export const deleteLeave = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, { headers: authHeaders() });
  return res.data;
};
