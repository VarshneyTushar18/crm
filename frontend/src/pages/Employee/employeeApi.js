import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/`,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

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