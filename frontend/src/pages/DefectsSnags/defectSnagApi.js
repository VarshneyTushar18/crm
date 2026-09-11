import axios from "axios";
import { API_BASE_URL, multipartAuthHeaders } from "@/config/serverApiConfig";

const API = `${API_BASE_URL}/defect-snag`;

const authHeaders = () => {
  const token =
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("authToken") ||
    window.localStorage.getItem("erpToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const unwrap = (res) => res?.data?.result || res?.data?.data || res?.data || null;

export const getDefectSnags = async (jobId, status) => {
  const res = await axios.get(`${API}/list/${jobId}`, {
    headers: { ...authHeaders() },
    params: status ? { status } : undefined,
  });
  return unwrap(res) || [];
};

export const getOpenDefectSnagCount = async (jobId) => {
  const res = await axios.get(`${API}/open-count/${jobId}`, {
    headers: { ...authHeaders() },
  });
  return unwrap(res) || { count: 0, hasOpen: false };
};

export const createDefectSnag = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: { ...authHeaders(), "Content-Type": "application/json" },
  });
  return unwrap(res);
};

export const updateDefectSnag = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, {
    headers: { ...authHeaders(), "Content-Type": "application/json" },
  });
  return unwrap(res);
};

export const closeDefectSnag = async (id, payload) => {
  const res = await axios.post(`${API}/close/${id}`, payload, {
    headers: { ...authHeaders(), "Content-Type": "application/json" },
  });
  return unwrap(res);
};

export const uploadDefectSnagFiles = async (id, files, which = "evidence") => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await axios.post(`${API}/upload/${id}?which=${which}`, formData, {
    headers: multipartAuthHeaders(),
  });
  return unwrap(res);
};
