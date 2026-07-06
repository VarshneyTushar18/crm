import axios from "axios";
import { API_BASE_URL } from "@/config/serverApiConfig";

const API = `${API_BASE_URL}/productivity`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getProductivitySummary = async (params = {}) => {
  const res = await axios.get(`${API}/summary`, {
    headers: authHeaders(),
    params,
  });
  return res.data?.result || null;
};

export const getMyProductivitySummary = async (params = {}) => {
  const res = await axios.get(`${API}/my`, {
    headers: authHeaders(),
    params,
  });
  return res.data?.result || null;
};
