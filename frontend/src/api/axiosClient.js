import axios from "axios";
import { BASE_URL } from '@/config/serverApiConfig';

const axiosClient = axios.create({
  baseURL: BASE_URL,
});

// ✅ attach token automatically
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default axiosClient;
