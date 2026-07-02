import axios from "axios";
import { API_BASE_URL, multipartAuthHeaders } from '@/config/serverApiConfig';

const API = `${API_BASE_URL}/drafting`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getDraftingRecords = async (jobId) => {
  const res = await axios.get(`${API}/list/${jobId}`, {
    headers: authHeaders(),
  });
  return res.data?.result || [];
};

export const createDraftingRecord = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: authHeaders(),
  });
  return res.data?.result || null;
};

export const updateDraftingRecord = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, {
    headers: authHeaders(),
  });
  return res.data?.result || null;
};

export const deleteDraftingRecord = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, {
    headers: authHeaders(),
  });
  return res.data?.result || null;
};

export const uploadDraftingPdf = async (id, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await axios.post(`${API}/upload/${id}`, formData, {
    headers: multipartAuthHeaders(),
  });
  return res.data?.result || null;
};