import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const API_BASE = API_BASE_URL;

export const getPublicSettings = async () => {
  const res = await axios.get(`${API_BASE}/settings/public`);
  return res.data?.result;
};