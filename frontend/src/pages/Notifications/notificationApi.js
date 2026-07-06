import axios from "axios";
import { API_BASE_URL } from "@/config/serverApiConfig";

const API = `${API_BASE_URL}/notifications`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getCustomerNotificationReceipts = async (params = {}) => {
  const res = await axios.get(`${API}/admin/customer-receipts`, {
    headers: authHeaders(),
    params,
  });
  return res.data?.result || { items: [], unreadCount: 0 };
};
