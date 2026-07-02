const rawBackend =
  import.meta.env.VITE_BACKEND_SERVER ||
  import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8888');

const BACKEND = rawBackend.endsWith('/') ? rawBackend : `${rawBackend}/`;

const normalizedApiBaseUrl = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : `${BACKEND}api`;

// No trailing slash — use `${API_BASE_URL}/path` when building URLs.
export const API_BASE_URL = normalizedApiBaseUrl.endsWith('/api')
  ? normalizedApiBaseUrl
  : `${normalizedApiBaseUrl}/api`;
export const BASE_URL = BACKEND;
export const WEBSITE_URL = 'http://cloud.idurarapp.com/';
export const DOWNLOAD_BASE_URL = `${BACKEND}download/`;
export const ACCESS_TOKEN_NAME = 'x-auth-token';

export const FILE_BASE_URL = import.meta.env.VITE_FILE_BASE_URL || BACKEND;

/** Build absolute URL for uploaded files (/uploads/...) */
export const buildFileUrl = (fileUrl = "") => {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }
  const base = FILE_BASE_URL.endsWith("/") ? FILE_BASE_URL : `${FILE_BASE_URL}/`;
  return `${base}${String(fileUrl).replace(/^\//, "")}`;
};

/** Auth headers for multipart uploads — do NOT set Content-Type (axios adds boundary). */
export const multipartAuthHeaders = () => {
  const token =
    (typeof window !== "undefined" &&
      (window.localStorage.getItem("token") ||
        window.localStorage.getItem("authToken") ||
        window.localStorage.getItem("erpToken"))) ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};
