import axiosClient from "../../api/axiosClient";
import { API_BASE_URL } from '@/config/serverApiConfig';

// NOTE: backend endpoints adjust if your routes differ
export const getCustomers = async () => {
  console.log("Calling:", `${API_BASE_URL}customer/list`);
  const res = await axiosClient.get("/api/customer/list");
  return res.data?.result || [];
};


export const createCustomer = async (payload) => {
  const res = await axiosClient.post("/api/customer/create", payload);
  return res.data;
};

export const updateCustomer = async (id, payload) => {
  const res = await axiosClient.put(`/api/customer/update/${id}`, payload);
  return res.data;
};

export const deleteCustomer = async (id) => {
  const res = await axiosClient.delete(`/api/customer/delete/${id}`);
  return res.data;
};

export const createCustomerPortalLogin = async (id, password) => {
  const res = await axiosClient.post(`/api/customer/portal-login/${id}`, { password });
  return res.data;
};

export const resetCustomerPortalPassword = async (id, newPassword) => {
  const res = await axiosClient.post(`/api/customer/reset-password/${id}`, {
    newPassword,
  });
  return res.data;
};
