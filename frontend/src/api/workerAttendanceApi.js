import axios from "axios";
import { API_BASE_URL } from "@/config/serverApiConfig";

const API = `${API_BASE_URL}/attendance`;

const authHeaders = () => {
  const token =
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("authToken") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getAttendanceStatus = async () => {
  const res = await axios.get(`${API}/status`, { headers: authHeaders() });
  return res.data?.result || null;
};

export const checkInAttendance = async (payload = {}) => {
  const res = await axios.post(`${API}/check-in`, payload, {
    headers: authHeaders(),
  });
  return res.data;
};

export const checkOutAttendance = async (payload = {}) => {
  const res = await axios.post(`${API}/check-out`, payload, {
    headers: authHeaders(),
  });
  return res.data;
};

export const getAttendanceHistory = async () => {
  const res = await axios.get(`${API}/history`, { headers: authHeaders() });
  return res.data?.result || [];
};

export const getAttendanceTimesheet = async (params = {}) => {
  const res = await axios.get(`${API}/timesheet`, {
    headers: authHeaders(),
    params,
  });
  return res.data?.result || [];
};

/** Admin: delete check-in / check-out selfie(s). which = 'in' | 'out' | 'both' */
export const deleteAttendancePhotos = async (sessionId, which = "both") => {
  const res = await axios.delete(`${API}/timesheet/${sessionId}/photos`, {
    headers: authHeaders(),
    data: { which },
  });
  return res.data;
};
