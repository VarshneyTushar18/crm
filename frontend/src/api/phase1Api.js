import axios from "axios";
import { API_BASE_URL, multipartAuthHeaders } from "@/config/serverApiConfig";

const client = axios.create({ baseURL: `${API_BASE_URL}/` });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getLeadSources = () => client.get("settings/lead-sources");
export const saveLeadSources = (sources) =>
  client.put("settings/lead-sources", { sources });

export const listSuppliers = () => client.get("procurement/supplier/list");
export const createSupplier = (data) => client.post("procurement/supplier/create", data);
export const updateSupplier = (id, data) =>
  client.patch(`procurement/supplier/update/${id}`, data);
export const deleteSupplier = (id) => client.delete(`procurement/supplier/delete/${id}`);

export const listSites = () => client.get("procurement/site/list");
export const createSite = (data) => client.post("procurement/site/create", data);
export const updateSite = (id, data) => client.patch(`procurement/site/update/${id}`, data);
export const deleteSite = (id) => client.delete(`procurement/site/delete/${id}`);

export const listRfqs = (jobId) =>
  client.get("rfq/rfq/list", { params: jobId ? { jobId } : {} });
export const createRfq = (data) => client.post("rfq/rfq/create", data);
export const sendRfq = (id) => client.post(`rfq/rfq/send/${id}`);
export const awardRfq = (id, data) => client.post(`rfq/rfq/award/${id}`, data);

export const listPurchaseOrders = (jobId) =>
  client.get("rfq/purchase-order/list", { params: jobId ? { jobId } : {} });
export const updatePurchaseOrder = (id, data) =>
  client.patch(`rfq/purchase-order/update/${id}`, data);
export const receivePurchaseOrder = (id, data) =>
  client.post(`rfq/purchase-order/receive/${id}`, data);

export const uploadMeasurementFiles = (id, files) => {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  return client.post(`measurement/upload/${id}`, formData, {
    headers: multipartAuthHeaders(),
  });
};
