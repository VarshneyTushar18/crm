import axios from "axios";
import { API_BASE_URL } from "@/config/serverApiConfig";

const authHeaders = () => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("erpToken") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const postAssistantChat = async (messages) => {
  const res = await axios.post(
    `${API_BASE_URL}/assistant/chat`,
    { messages },
    { headers: authHeaders() }
  );
  if (!res.data?.success) {
    throw new Error(res.data?.message || "Assistant request failed");
  }
  return res.data.result;
};

/**
 * SSE chat stream. Events: status | delta | reset | done | error
 * Same answer quality as postAssistantChat; tokens arrive as they're generated.
 */
export const streamAssistantChat = async (messages, { onEvent, signal } = {}) => {
  const res = await fetch(`${API_BASE_URL}/assistant/chat/stream`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!res.ok) {
    let msg = "Assistant request failed";
    try {
      const data = await res.json();
      msg = data?.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  if (!res.body) {
    throw new Error("Streaming is not supported in this browser");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult = null;

  const handleEvent = (ev) => {
    if (!ev || typeof ev !== "object") return;
    onEvent?.(ev);
    if (ev.type === "done") finalResult = ev.result || null;
    if (ev.type === "error") {
      throw new Error(ev.message || "Assistant request failed");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      const dataLine = chunk
        .split("\n")
        .map((l) => l.trimEnd())
        .find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const raw = dataLine.replace(/^data:\s?/, "");
      if (!raw || raw === "[DONE]") continue;
      let ev;
      try {
        ev = JSON.parse(raw);
      } catch {
        continue;
      }
      handleEvent(ev);
    }
  }

  if (buffer.trim()) {
    const dataLine = buffer
      .split("\n")
      .map((l) => l.trimEnd())
      .find((l) => l.startsWith("data:"));
    if (dataLine) {
      try {
        handleEvent(JSON.parse(dataLine.replace(/^data:\s?/, "")));
      } catch {
        // ignore
      }
    }
  }

  if (!finalResult) {
    throw new Error("Assistant stream ended without a result");
  }
  return finalResult;
};

export const sendAssistantEmailDraft = async (draftId) => {
  const res = await axios.post(
    `${API_BASE_URL}/assistant/email-drafts/${draftId}/send`,
    {},
    { headers: authHeaders() }
  );
  if (!res.data?.success) {
    throw new Error(res.data?.message || "Failed to send email");
  }
  return res.data.result;
};

export const cancelAssistantEmailDraft = async (draftId) => {
  const res = await axios.post(
    `${API_BASE_URL}/assistant/email-drafts/${draftId}/cancel`,
    {},
    { headers: authHeaders() }
  );
  if (!res.data?.success) {
    throw new Error(res.data?.message || "Failed to cancel draft");
  }
  return res.data.result;
};

export const updateAssistantEmailDraft = async (draftId, { subject, body, title } = {}) => {
  const res = await axios.patch(
    `${API_BASE_URL}/assistant/email-drafts/${draftId}`,
    { subject, body, title },
    { headers: authHeaders() }
  );
  if (!res.data?.success) {
    throw new Error(res.data?.message || "Failed to update draft");
  }
  return res.data.result;
};

/** True for assistant export paths (relative or absolute). */
export const isAssistantExportHref = (href) => {
  if (!href || typeof href !== "string") return false;
  return (
    href.includes("/assistant/exports/") ||
    href.startsWith("assistant/exports/")
  );
};

/**
 * Authenticated blob download for no-save assistant exports.
 * Builds Excel/CSV on the server in memory — nothing stored on disk.
 */
export const downloadAssistantExport = async (href) => {
  let pathAndQuery = String(href || "").trim();
  if (!pathAndQuery) throw new Error("Missing export link");

  if (pathAndQuery.startsWith("http://") || pathAndQuery.startsWith("https://")) {
    try {
      const u = new URL(pathAndQuery);
      pathAndQuery = `${u.pathname}${u.search}`;
    } catch {
      // keep as-is
    }
  }

  // Normalize to /assistant/exports/...
  const idx = pathAndQuery.indexOf("/assistant/exports/");
  if (idx >= 0) {
    pathAndQuery = pathAndQuery.slice(idx);
  } else if (pathAndQuery.startsWith("assistant/exports/")) {
    pathAndQuery = `/${pathAndQuery}`;
  } else if (!pathAndQuery.startsWith("/")) {
    pathAndQuery = `/${pathAndQuery}`;
  }

  // Strip leading /api if present so we don't double it with API_BASE_URL
  if (pathAndQuery.startsWith("/api/")) {
    pathAndQuery = pathAndQuery.slice(4);
  }

  const url = `${API_BASE_URL}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    let msg = "Download failed";
    try {
      const data = await res.json();
      msg = data?.message || msg;
    } catch {
      const txt = await res.text().catch(() => "");
      if (txt) msg = txt;
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] || "crm-export.xls";

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
  return filename;
};
