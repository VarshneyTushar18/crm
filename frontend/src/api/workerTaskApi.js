import axios from "axios";
import { API_BASE_URL, multipartAuthHeaders } from "@/config/serverApiConfig";

const API = `${API_BASE_URL}/worker-tasks`;

const authHeaders = () => {
  const token =
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("authToken") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getMyWorkerTasks = async (params = {}) => {
  const res = await axios.get(`${API}/mine`, {
    headers: authHeaders(),
    params,
  });
  return res.data?.result || [];
};

export const listWorkerTasks = async (params = {}) => {
  const res = await axios.get(`${API}/list`, {
    headers: authHeaders(),
    params,
  });
  return res.data?.result || [];
};

export const getWorkerTaskReviewQueue = async () => {
  const res = await axios.get(`${API}/review-queue`, {
    headers: authHeaders(),
  });
  return res.data?.result || [];
};

export const createWorkerTask = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: authHeaders(),
  });
  return res.data;
};

export const startWorkerTask = async (id, payload = {}) => {
  const res = await axios.post(`${API}/start/${id}`, payload, {
    headers: authHeaders(),
  });
  return res.data;
};

export const completeWorkerTask = async (id, payload = {}) => {
  const res = await axios.post(`${API}/complete/${id}`, payload, {
    headers: authHeaders(),
  });
  return res.data;
};

export const uploadWorkerTaskProof = async (id, files = []) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await axios.post(`${API}/upload-proof/${id}`, formData, {
    headers: { ...authHeaders(), ...multipartAuthHeaders() },
  });
  return res.data;
};

export const pingWorkerTaskLocation = async (id, payload) => {
  const res = await axios.post(`${API}/location-ping/${id}`, payload, {
    headers: authHeaders(),
  });
  return res.data;
};

export const reviewWorkerTask = async (id, payload) => {
  const res = await axios.post(`${API}/review/${id}`, payload, {
    headers: authHeaders(),
  });
  return res.data;
};

export const deleteWorkerTask = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, {
    headers: authHeaders(),
  });
  return res.data;
};
