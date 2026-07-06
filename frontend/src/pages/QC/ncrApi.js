import axios from "axios";
import { API_BASE_URL } from "@/config/serverApiConfig";

const API = `${API_BASE_URL}/ncr`;

const authHeaders = () => {
  const token = window.localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getNcrItems = async (jobId) => {
  const res = await axios.get(`${API}/list/${jobId}`, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || [];
};

export const createNcrItem = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};

export const updateNcrItem = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};

export const recordReinspection = async (id, payload) => {
  const res = await axios.patch(`${API}/reinspect/${id}`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data?.result || null;
};
