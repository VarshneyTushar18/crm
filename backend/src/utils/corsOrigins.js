const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://crm-front-dun.vercel.app",
];

const getAllowedOrigins = () => {
  const fromEnv = String(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
};

const isOriginAllowed = (origin) => {
  if (!origin) return true;

  if (getAllowedOrigins().includes(origin)) return true;

  // Vercel preview deployments for frontend/backend projects.
  if (/^https:\/\/[\w-]+\.vercel\.app$/i.test(origin)) return true;

  return false;
};

const applyCorsHeaders = (req, res) => {
  const origin = req.headers.origin;

  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-auth-token, X-Requested-With"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
    res.setHeader("Vary", "Origin");
  }
};

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  applyCorsHeaders,
};
