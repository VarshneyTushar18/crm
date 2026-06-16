import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const API_BASE = `${API_BASE_URL}/auth`;

export const loginApi = async (payload) => {
  // payload: { role, identifier, password }
  const res = await axios.post(`${API_BASE}/login`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data;
};

export const registerCustomerApi = async (payload) => {
  // payload: { name, email, password }
  const res = await axios.post(`${API_BASE}/customer/register`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data;
};

export const forgotPasswordApi = async (payload) => {
  // payload: { email }
  const res = await axios.post(`${API_BASE}/forgot-password`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data;
};

export const resetPasswordApi = async (payload) => {
  // payload: { token, newPassword }
  const res = await axios.post(`${API_BASE}/reset-password`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data;
};
