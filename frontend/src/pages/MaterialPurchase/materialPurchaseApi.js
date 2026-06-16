import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const API = `${API_BASE_URL}/material-purchase`;

const authHeaders = () => {
  const token = window.localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getMaterialItems = async (jobId) => {
  const res = await axios.get(`${API}/list/${jobId}`, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || [];
};

export const createMaterialItem = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};

export const updateMaterialItem = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};

export const deleteMaterialItem = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};