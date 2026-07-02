import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/`,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token") || localStorage.getItem("authToken");
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

export const getAttendance = async () => {
  const res = await axiosInstance.get("attendance/list");
  return res.data;
};

export const createAttendance = async (data) => {
  const res = await axiosInstance.post("attendance/create", data);
  return res.data;
};

export const updateAttendance = async (id, data) => {
  const res = await axiosInstance.patch(`attendance/update/${id}`, data);
  return res.data;
};
