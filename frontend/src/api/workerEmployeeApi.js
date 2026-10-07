import axios from "axios";
import { API_BASE_URL } from "@/config/serverApiConfig";

const authHeaders = () => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("jwt") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const downloadMyAppointmentLetter = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/employee/my-appointment-letter`,
    { headers: authHeaders(), responseType: "blob" }
  );

  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Appointment-Letter.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const viewMyAppointmentLetter = async () => {
  const preview = window.open("about:blank", "_blank");
  const response = await axios.get(
    `${API_BASE_URL}/employee/my-appointment-letter`,
    { headers: authHeaders(), responseType: "blob" }
  );

  const url = window.URL.createObjectURL(response.data);
  if (preview) preview.location.href = url;
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
};