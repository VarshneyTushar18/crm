import axios from "axios";
import { API_BASE_URL } from "@/config/serverApiConfig";

const API = `${API_BASE_URL}/day-off`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Active company + personal day-offs (today / tomorrow by default). */
export const getActiveDayOffs = async (params = {}) => {
  const res = await axios.get(`${API}/active`, {
    headers: authHeaders(),
    params,
  });
  return res.data?.result || { company: [], personal: [] };
};
