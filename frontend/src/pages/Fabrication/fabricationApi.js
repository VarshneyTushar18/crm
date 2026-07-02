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
  const result = res.data?.result;
  if (Array.isArray(result)) {
    return { items: result, overallProgress: 0, totalDrawings: result.length, completedDrawings: 0 };
  }
  return {
    items: result?.items || [],
    overallProgress: result?.overallProgress ?? 0,
    totalDrawings: result?.totalDrawings ?? 0,
    completedDrawings: result?.completedDrawings ?? 0,
  };
};

export const getFabricationHistory = async (jobId) => {
  const res = await axios.get(`${API}/history/${jobId}`, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || [];
};

export const createFabricationItem = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data;
};

export const updateFabricationItem = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data;
};

export const updateFabricationProgress = async (id, payload) => {
  const res = await axios.patch(`${API}/progress/${id}`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data;
};

export const deleteFabricationItem = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};

export const uploadFabricationFiles = async (id, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await axios.post(`${API}/upload/${id}`, formData, {
    headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
  });
  return res.data;
};
