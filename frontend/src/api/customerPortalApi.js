import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const BASE = API_BASE_URL;

// ⚠️ IMPORTANT: same key use karo har jagah
const TOKEN_KEY = "token"
const ROLE_KEY = "role";

const customerHeaders = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
};

// ================= LOGIN =================
export const customerLogin = async ({ identifier, password }) => {
  const res = await axios.post(`${BASE}/auth/login`, {
    role: "customer",
    identifier,
    password,
  });

  return res.data;
};

// ================= PROFILE =================
export const getCustomerMe = async () => {
  const res = await axios.get(`${BASE}/customer/me`, {
    headers: customerHeaders(),
  });
  return res.data?.result;
};

// ================= PROJECTS =================
export const getCustomerProjects = async () => {
  const res = await axios.get(`${BASE}/customer/projects`, {
    headers: customerHeaders(),
  });
  return res.data?.result || [];
};

// ================= PROJECT DETAILS =================
export const getCustomerProjectById = async (projectId) => {
  const res = await axios.get(`${BASE}/customer/projects/${projectId}`, {
    headers: customerHeaders(),
  });
  return res.data?.result;
};

// ================= PAYMENTS =================
export const getCustomerPaymentSummary = async () => {
  const res = await axios.get(`${BASE}/customer/payments/summary`, {
    headers: customerHeaders(),
  });
  return res.data?.result;
};

// ================= ENQUIRY =================
export const submitCustomerEnquiry = async (payload) => {
  const res = await axios.post(`${BASE}/customer/enquiry`, payload, {
    headers: customerHeaders(),
  });
  return res.data;
};

// ================= CONTACT =================
export const createContactRequest = async (payload) => {
  const res = await axios.post(`${BASE}/contact/create`, payload, {
    headers: customerHeaders(),
  });
  return res.data;
};

export const getCustomerContacts = async () => {
  const res = await axios.get(`${BASE}/contact/my`, {
    headers: customerHeaders(),
  });
  return res.data?.result || [];
};

export const replyContactRequest = async (id, payload) => {
  const res = await axios.post(`${BASE}/contact/${id}/reply`, payload, {
    headers: customerHeaders(),
  });
  return res.data;
};