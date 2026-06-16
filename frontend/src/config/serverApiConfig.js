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

//  console.log(
//    '🚀 Welcome to IDURAR ERP CRM! Did you know that we also offer commercial customization services? Contact us at hello@idurarapp.com for more information.'
//  );
