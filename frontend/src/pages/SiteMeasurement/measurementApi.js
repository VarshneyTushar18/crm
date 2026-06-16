import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const API = `${API_BASE_URL}/measurement`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getMeasurements = async () => {
  const res = await axios.get(`${API}/list`, {
    headers: authHeaders(),
  });
  return res.data.result;
};

export const createMeasurement = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: authHeaders(),
  });
  return res.data.result;
};

export const updateMeasurement = async (id, payload) => {
  const res = await axios.patch(`${API}/update/${id}`, payload, {
    headers: authHeaders(),
  });
  return res.data.result;
};

export const deleteMeasurement = async (id) => {
  const res = await axios.delete(`${API}/delete/${id}`, {
    headers: authHeaders(),
  });
  return res.data.result;
};