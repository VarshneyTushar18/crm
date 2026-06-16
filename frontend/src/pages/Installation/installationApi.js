import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const getAuthToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("erpToken");

const authHeaders = (isMultipart = false) => {
    const token = getAuthToken();

    const headers = {
        Authorization: token ? `Bearer ${token}` : "",
    };

    if (!isMultipart) {
        headers["Content-Type"] = "application/json";
    }

    return headers;
};

const unwrap = (res) => res?.data?.result || res?.data?.data || res?.data || [];

export const getInstallationItems = async (jobId) => {
    const res = await axios.get(`${API_BASE_URL}/installation/list/${jobId}`, {
        headers: authHeaders(),
    });
    return unwrap(res);
};

export const createInstallationItem = async (payload) => {
    const res = await axios.post(`${API_BASE_URL}/installation/create`, payload, {
        headers: authHeaders(),
    });
    return unwrap(res);
};

export const updateInstallationItem = async (id, payload) => {
    const res = await axios.patch(
        `${API_BASE_URL}/installation/update/${id}`,
        payload,
        {
            headers: authHeaders(),
        }
    );
    return unwrap(res);
};

export const deleteInstallationItem = async (id) => {
    const res = await axios.delete(`${API_BASE_URL}/installation/delete/${id}`, {
        headers: authHeaders(),
    });
    return unwrap(res);
};

export const getInstallationSummary = async (jobId) => {
    const res = await axios.get(`${API_BASE_URL}/installation/summary/${jobId}`, {
        headers: authHeaders(),
    });
    return unwrap(res);
};

export const saveInstallationSummary = async (jobId, payload) => {
    const res = await axios.patch(
        `${API_BASE_URL}/installation/summary/${jobId}`,
        payload,
        {
            headers: authHeaders(),
        }
    );
    return unwrap(res);
};

export const finalizeJobCompletion = async (jobId, formData) => {
    const res = await axios.post(
        `${API_BASE_URL}/installation/finalize/${jobId}`,
        formData,
        {
            headers: authHeaders(true),
        }
    );
    return unwrap(res);
};

export const markInstallationComplete = async (jobId) => {
    const res = await axios.post(
        `${API_BASE_URL}/installation/mark-complete/${jobId}`,
        {},
        {
            headers: authHeaders(),
        }
    );
    return unwrap(res);
};