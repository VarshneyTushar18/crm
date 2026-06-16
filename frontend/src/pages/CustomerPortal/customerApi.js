import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const API_BASE = API_BASE_URL;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ================= LOGIN =================
export const customerLogin = async ({ identifier, password, role = "customer" }) => {
  const res = await axios.post(`${API_BASE}/auth/login`, {
    role,
    identifier,
    password,
  });

  return res.data;
};

// ================= PROFILE =================
export const customerGetMe = async () => {
  const res = await axios.get(`${API_BASE}/customer/me`, {
    headers: authHeaders(),
  });
  return res.data?.result;
};

// ================= PROJECTS =================
export const customerGetProjects = async () => {
  const res = await axios.get(`${API_BASE}/customer/projects`, {
    headers: authHeaders(),
  });
  return res.data?.result || [];
};

export const customerGetProjectById = async (id) => {
  const res = await axios.get(`${API_BASE}/customer/projects/${id}`, {
    headers: authHeaders(),
  });
  return res.data?.result;
};

// ================= PAYMENTS =================
export const customerGetPaymentSummary = async () => {
  const res = await axios.get(`${API_BASE}/customer/payments/summary`, {
    headers: authHeaders(),
  });
  return res.data?.result;
};

// ================= INVOICES =================
export const customerGetInvoices = async () => {
  const res = await axios.get(`${API_BASE}/customer/invoices`, {
    headers: authHeaders(),
  });
  return res.data?.result || [];
};

export const customerNotifyPayment = async (id, data) => {
  const res = await axios.post(`${API_BASE}/customer/invoice/notify/${id}`, data, {
    headers: authHeaders(),
  });
  return res.data;
};

// ================= CONTACT =================
export const createContact = async (data) => {
  const res = await axios.post(`${API_BASE}/contact/create`, data, {
    headers: authHeaders(),
  });
  return res.data;
};