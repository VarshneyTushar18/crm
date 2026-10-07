import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';
import { attachAuthExpiryInterceptor } from "@/utils/sessionExpiry";

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/`,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("jwt") ||
      "";
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

attachAuthExpiryInterceptor(axiosInstance);

export const getEmployees = async () => {
  const res = await axiosInstance.get("employee/list");
  return res.data;
};

export const createEmployee = async (data) => {
  const res = await axiosInstance.post("employee/create", data);
  return res.data;
};

export const updateEmployee = async (id, data) => {
  const res = await axiosInstance.patch(`employee/update/${id}`, data);
  return res.data;
};

export const deleteEmployee = async (id) => {
  const res = await axiosInstance.delete(`employee/delete/${id}`);
  return res.data;
};

export const resetEmployeePassword = async (id, newPassword) => {
  const res = await axiosInstance.patch(`employee/reset-password/${id}`, {
    newPassword,
  });
  return res.data;
};

export const downloadAppointmentLetter = async (id) => {
  const res = await axiosInstance.get(`employee/appointment-letter/${id}`, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Appointment-Letter-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const viewAppointmentLetter = async (id) => {
  const preview = window.open("about:blank", "_blank");
  const res = await axiosInstance.get(`employee/appointment-letter/${id}`, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(res.data);
  if (preview) preview.location.href = url;
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
};