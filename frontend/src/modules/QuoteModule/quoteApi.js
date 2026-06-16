import axios from "axios";
import { API_BASE_URL } from "../../config/serverApiConfig";

const API = `${API_BASE_URL}/quote`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const createQuote = async (payload) => {
  const res = await axios.post(`${API}/create`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data;
};

export const approveQuote = async (quoteId, payload = {}) => {
  const res = await axios.post(`${API}/approve/${quoteId}`, payload, {
    headers: { ...authHeaders() },
  });
  return res.data;
};