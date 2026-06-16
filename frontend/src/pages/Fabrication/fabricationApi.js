import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const API = `${API_BASE_URL}/fabrication`;

const authHeaders = () => {
  const token = window.localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getFabricationItems = async (jobId) => {
  const res = await axios.get(`${API}/list/${jobId}`, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || [];
};

export const createFabricationItem = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};

export const updateFabricationItem = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};

export const deleteFabricationItem = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};