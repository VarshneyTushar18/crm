import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const API_BASE = `${API_BASE_URL}/auth`;

export const loginApi = async (payload) => {
  // payload: { role, identifier, password, deviceId?, deviceLabel? }
  const res = await axios.post(`${API_BASE}/login`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data;
};

export const requestLoginOtpApi = async (payload) => {
  const res = await axios.post(`${API_BASE}/login/request-otp`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data;
};

export const verifyLoginOtpApi = async (payload) => {
  const res = await axios.post(`${API_BASE}/login/verify-otp`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data;
};

export const resendLoginOtpApi = async (payload) => {
  const res = await axios.post(`${API_BASE}/login/resend-otp`, payload, {
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

export const meApi = async (token) => {
  const res = await axios.get(`${API_BASE}/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return res.data;
};

export const logoutApi = async (token) => {
  const res = await axios.post(
    `${API_BASE}/logout`,
    {},
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  );
  return res.data;
};
