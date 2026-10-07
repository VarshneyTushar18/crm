import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Drawer, Input, Spin, Tooltip, Typography, message } from "antd";
import {
  CloseOutlined,
  DeleteOutlined,
  MenuOutlined,
  PlusOutlined,
  SendOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { streamAssistantChat, isAssistantExportHref, downloadAssistantExport, sendAssistantEmailDraft, cancelAssistantEmailDraft, updateAssistantEmailDraft } from "@/api/assistantApi";
import useResponsive from "@/hooks/useResponsive";
import askCrmIcon from "@/style/images/ask-crm-icon.jpg";

const { Title } = Typography;

function AskCrmIcon({ size = 20, className, style }) {
  return (
    <img
      src={askCrmIcon}
      alt=""
      className={className}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "cover",
        borderRadius: "50%",
        display: "block",
        ...style,
      }}
    />
  );
}

const WELCOME =
  "Ask about check-ins, active jobs, dashboard summary, schedules, or a job's stage and blockers.";

const SUGGESTIONS = [
  "Summarize today's check-ins",
  "Which jobs are active right now?",
  "Give me a dashboard summary",
  "What stage is my latest job on?",
];

const MAX_CONVERSATIONS = 30;
const MAX_MESSAGES = 100;
const HISTORY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STORAGE_PREFIX = "ask-crm-history:";

const AdminAssistantContext = createContext(null);

function isInternalAppPath(href) {
  if (!href || typeof href !== "string") return false;
  return href.startsWith("/admin/") || href.startsWith("/worker/") || href.startsWith("/portal/");
}

function AssistantMessage({ content, onNavigate, onExportDownload }) {
  const components = useMemo(
    () => ({
      table: ({ children }) => (
        <div className="ask-crm-table-wrap">
          <table>{children}</table>
        </div>
      ),
      a: ({ href, children }) => {
        if (isAssistantExportHref(href)) {
          return (
            <a
              href={href}
              className="ask-crm-md__link ask-crm-md__export"
              onClick={(e) => {
                e.preventDefault();
                onExportDownload?.(href);
              }}
            >
              {children}
            </a>
          );
        }
        if (isInternalAppPath(href)) {
          return (
            <a
              href={href}
              className="ask-crm-md__link"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.(href);
              }}
            >
              {children}
            </a>
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="ask-crm-md__link">
            {children}
          </a>
        );
      },
    }),
    [onNavigate, onExportDownload]
  );

  return (
    <div className="ask-crm-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function EmailDraftCard({ draft, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const status = String(draft?.status || "pending");
  const pending = status === "pending";

  const startEdit = () => {
    if (!pending || busy) return;
    setEditSubject(String(draft?.subject || ""));
    setEditBody(String(draft?.body || ""));
    setEditing(true);
  };

  const discardEdit = () => {
    setEditing(false);
    setEditSubject("");
    setEditBody("");
  };

  const saveEdit = async () => {
    if (!draft?.draftId || busy) return;
    const subject = editSubject.trim();
    const body = editBody.trim();
    if (!subject) {
      message.error("Subject is required");
      return;
    }
    if (!body) {
      message.error("Body is required");
      return;
    }
    setBusy(true);
    try {
      const result = await updateAssistantEmailDraft(draft.draftId, {
        subject,
        body,
        title: subject,
      });
      onUpdated?.(result);
      setEditing(false);
      message.success("Draft updated");
    } catch (err) {
      message.error(err?.message || "Could not update draft");
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!draft?.draftId || busy || editing) return;
    setBusy(true);
    try {
      const result = await sendAssistantEmailDraft(draft.draftId);
      onUpdated?.(result);
      message.success(
        result?.emailsSent
          ? `Email sent (${result.emailsSent} delivered)`
          : "Email send finished"
      );
    } catch (err) {
      message.error(err?.message || "Could not send email");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!draft?.draftId || busy) return;
    setBusy(true);
    try {
      const result = await cancelAssistantEmailDraft(draft.draftId);
      onUpdated?.(result);
      setEditing(false);
      message.info("Draft cancelled");
    } catch (err) {
      message.error(err?.message || "Could not cancel draft");
    } finally {
      setBusy(false);
    }
  };

  const toLabel =
    draft?.scope === "all"
      ? `All workers (${draft.recipientCount || 0})`
      : [draft?.recipientName, draft?.to || draft?.workerId].filter(Boolean).join(" · ") ||
        "Recipient";

  return (
    <div className={`ask-crm-email-draft ask-crm-email-draft--${status}`}>
      <div className="ask-crm-email-draft__badge">
        {pending ? "Approval required" : status === "sent" ? "Sent" : status}
      </div>
      <div className="ask-crm-email-draft__row">
        <span className="ask-crm-email-draft__label">To</span>
        <span>{toLabel}</span>
      </div>
      {editing ? (
        <>
          <div className="ask-crm-email-draft__row ask-crm-email-draft__row--edit">
            <span className="ask-crm-email-draft__label">Subject</span>
            <Input
              size="small"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              disabled={busy}
              maxLength={200}
            />
          </div>
          <Input.TextArea
            className="ask-crm-email-draft__body-input"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            disabled={busy}
            autoSize={{ minRows: 4, maxRows: 12 }}
            maxLength={8000}
          />
        </>
      ) : (
        <>
          <div className="ask-crm-email-draft__row">
            <span className="ask-crm-email-draft__label">Subject</span>
            <span>{draft?.subject}</span>
          </div>
          <div className="ask-crm-email-draft__body">{draft?.body}</div>
        </>
      )}
      {pending ? (
        <div className="ask-crm-email-draft__actions">
          {editing ? (
            <>
              <Button size="small" onClick={discardEdit} disabled={busy}>
                Discard
              </Button>
              <Button size="small" type="default" loading={busy} onClick={saveEdit}>
                Save
              </Button>
            </>
          ) : (
            <>
              <Button size="small" onClick={cancel} disabled={busy}>
                Cancel
              </Button>
              <Button size="small" onClick={startEdit} disabled={busy}>
                Edit
              </Button>
              <Button type="primary" size="small" loading={busy} onClick={approve}>
                Approve &amp; Send
              </Button>
            </>
          )}
        </div>
      ) : status === "sent" ? (
        <div className="ask-crm-email-draft__meta">
          Sent to {draft?.emailsSent ?? 0}
          {draft?.notifiedCount != null ? ` · ${draft.notifiedCount} notified` : ""}
        </div>
      ) : null}
    </div>
  );
}

function getUserKey() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return String(user?._id || user?.id || user?.email || "admin");
  } catch {
    return "admin";
  }
}

function storageKey() {
  return `${STORAGE_PREFIX}${getUserKey()}`;
}

function createConversation(partial = {}) {
  return {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "New chat",
    updatedAt: Date.now(),
    messages: [],
    ...partial,
  };
}

function titleFromMessage(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

function isFreshConversation(c) {
  const updatedAt = Number(c?.updatedAt || 0);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return false;
  return Date.now() - updatedAt < HISTORY_TTL_MS;
}

function pruneConversations(conversations, activeId) {
  const fresh = (conversations || []).filter(isFreshConversation).slice(0, MAX_CONVERSATIONS);
  if (!fresh.length) {
    const created = createConversation();
    return { conversations: [created], activeId: created.id, pruned: true };
  }
  const nextActiveId = fresh.some((c) => c.id === activeId) ? activeId : fresh[0].id;
  return { conversations: fresh, activeId: nextActiveId, pruned: fresh.length !== (conversations || []).length };
}

function loadStoredState() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.conversations)) return null;
    const pruned = pruneConversations(parsed.conversations, parsed.activeId);
    // Rewrite storage immediately so expired chats leave the browser.
    saveStoredState(pruned.conversations, pruned.activeId);
    return {
      conversations: pruned.conversations,
      activeId: pruned.activeId,
    };
  } catch {
    return null;
  }
}

function saveStoredState(conversations, activeId) {
  try {
    const pruned = pruneConversations(conversations, activeId);
    localStorage.setItem(
      storageKey(),
      JSON.stringify({
        conversations: pruned.conversations,
        activeId: pruned.activeId,
      })
    );
    return pruned;
  } catch {
    // Quota or private mode — ignore; chat still works in-session.
    return null;
  }
}

function formatRelativeTime(ts) {
  const diff = Date.now() - Number(ts || 0);
  if (!Number.isFinite(diff) || diff < 0) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function useAdminAssistant() {
  return useContext(AdminAssistantContext);
}

function getAdminRole() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return String(user?.role || "").trim();
  } catch {
    return "";
  }
}

export function AskCrmHeaderButton({ size = "middle" }) {
  const ctx = useAdminAssistant();
  if (!ctx?.isAdmin) return null;
  const iconSize = size === "small" ? 16 : size === "large" ? 22 : 18;
  return (
    <Button
      type="primary"
      size={size}
      icon={<AskCrmIcon size={iconSize} />}
      onClick={ctx.open}
      style={{ background: "#339393", borderColor: "#339393" }}
    >
      Ask CRM
    </Button>
  );
}

export function AdminAssistantProvider({ children }) {
  const navigate = useNavigate();
  const initial = useMemo(() => {
    const stored = loadStoredState();
    if (stored?.conversations?.length) return stored;
    const fresh = createConversation();
    return { conversations: [fresh], activeId: fresh.id };
  }, []);

  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState(initial.conversations);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamStatus, setStreamStatus] = useState(""); // thinking | looking_up | ""

  const [historyOpen, setHistoryOpen] = useState(false);
  const listRef = useRef(null);
  const persistReady = useRef(false);
  const { isMobile } = useResponsive();

  const isAdmin = getAdminRole() === "admin";
  const drawerWidth = isMobile ? "100%" : "calc(100vw - 256px)";

  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0];
  const messages = activeConversation?.messages || [];

  const handleInternalNavigate = useCallback(
    (href) => {
      setOpen(false);
      navigate(href);
    },
    [navigate]
  );

  const handleExportDownload = useCallback(async (href) => {
    try {
      const filename = await downloadAssistantExport(href);
      message.success(`Downloaded ${filename}`);
    } catch (err) {
      message.error(err?.message || "Could not download the Excel report");
    }
  }, []);

  const openDrawer = useCallback(() => {
    setConversations((prev) => {
      const pruned = pruneConversations(prev, activeId);
      if (pruned.pruned || pruned.activeId !== activeId) {
        setActiveId(pruned.activeId);
      }
      saveStoredState(pruned.conversations, pruned.activeId);
      return pruned.conversations;
    });
    setOpen(true);
    if (!isMobile) setHistoryOpen(true);
  }, [isMobile, activeId]);

  useEffect(() => {
    if (!persistReady.current) {
      persistReady.current = true;
      // Ensure any already-expired chats are wiped from the browser on mount.
      const pruned = saveStoredState(conversations, activeId);
      if (pruned && (pruned.pruned || pruned.activeId !== activeId)) {
        setConversations(pruned.conversations);
        setActiveId(pruned.activeId);
      }
      return;
    }
    const pruned = saveStoredState(conversations, activeId);
    if (pruned && pruned.activeId !== activeId) {
      setActiveId(pruned.activeId);
      setConversations(pruned.conversations);
    }
  }, [conversations, activeId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading, open, activeId]);

  const updateActiveMessages = useCallback(
    (nextMessages, titleHint) => {
      setConversations((prev) =>
        prev
          .map((c) => {
            if (c.id !== activeId) return c;
            const title =
              c.title === "New chat" && titleHint ? titleFromMessage(titleHint) : c.title;
            return {
              ...c,
              title,
              updatedAt: Date.now(),
              messages: nextMessages.slice(-MAX_MESSAGES),
            };
          })
          .sort((a, b) => b.updatedAt - a.updatedAt)
      );
    },
    [activeId]
  );

  const startNewChat = useCallback(() => {
    const fresh = createConversation();
    setConversations((prev) => [fresh, ...prev].slice(0, MAX_CONVERSATIONS));
    setActiveId(fresh.id);
    setInput("");
    if (isMobile) setHistoryOpen(false);
  }, [isMobile]);

  const selectChat = useCallback(
    (id) => {
      setActiveId(id);
      setInput("");
      if (isMobile) setHistoryOpen(false);
    },
    [isMobile]
  );

  const deleteChat = useCallback(
    (id, e) => {
      e?.stopPropagation?.();
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (!next.length) {
          const fresh = createConversation();
          setActiveId(fresh.id);
          return [fresh];
        }
        if (id === activeId) {
          setActiveId(next[0].id);
        }
        return next;
      });
    },
    [activeId]
  );

  const send = useCallback(
    async (presetText) => {
      const text = String(presetText ?? input).trim();
      if (!text || loading || !activeId) return;

      const next = [...messages, { role: "user", content: text }];
      setInput("");
      setLoading(true);
      setStreamStatus("thinking");

      const conversationId = activeId;
      const patchLiveAssistant = (updater) => {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversationId) return c;
            const msgs = [...(c.messages || [])];
            const last = msgs[msgs.length - 1];
            if (!last || last.role !== "assistant" || !last.streaming) {
              return c;
            }
            const updated = updater(last);
            msgs[msgs.length - 1] = updated;
            return { ...c, messages: msgs, updatedAt: Date.now() };
          })
        );
      };

      // User message + placeholder bubble for live tokens
      updateActiveMessages(
        [...next, { role: "assistant", content: "", streaming: true }],
        text
      );

      try {
        const payload = next.map((m) => ({
          role: m.role,
          content: String(m.content || ""),
        }));

        const result = await streamAssistantChat(payload, {
          onEvent: (ev) => {
            if (ev.type === "status") {
              setStreamStatus(ev.status === "looking_up" ? "looking_up" : "thinking");
            } else if (ev.type === "reset") {
              patchLiveAssistant((m) => ({ ...m, content: "" }));
            } else if (ev.type === "delta" && typeof ev.text === "string") {
              setStreamStatus("");
              patchLiveAssistant((m) => ({
                ...m,
                content: `${m.content || ""}${ev.text}`,
              }));
            }
          },
        });

        let finalMessages =
          result.messages || [...next, { role: "assistant", content: result.reply }];

        const drafts = Array.isArray(result.emailDrafts) ? result.emailDrafts : [];
        if (drafts.length && finalMessages.length) {
          const lastIdx = finalMessages.length - 1;
          finalMessages = finalMessages.map((m, i) => {
            if (i !== lastIdx || m.role !== "assistant") return m;
            return { ...m, emailDrafts: drafts };
          });
        }

        updateActiveMessages(finalMessages, text);
      } catch (err) {
        const errText =
          err.response?.data?.message || err.message || "Could not reach the assistant.";
        message.error(errText);
        updateActiveMessages(
          [...next, { role: "assistant", content: `Sorry — ${errText}` }],
          text
        );
      } finally {
        setLoading(false);
        setStreamStatus("");
      }
    },
    [input, loading, messages, activeId, updateActiveMessages]
  );

  const updateMessageDraft = useCallback(
    (messageIndex, draftId, nextDraft) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeId) return c;
          const msgs = (c.messages || []).map((m, i) => {
            if (i !== messageIndex || !Array.isArray(m.emailDrafts)) return m;
            return {
              ...m,
              emailDrafts: m.emailDrafts.map((d) =>
                d.draftId === draftId ? { ...d, ...nextDraft } : d
              ),
            };
          });
          return { ...c, messages: msgs, updatedAt: Date.now() };
        })
      );
    },
    [activeId]
  );

  const value = { isAdmin, open: openDrawer };

  if (!isAdmin) {
    return children;
  }

  const showHistory = !isMobile || historyOpen;

  return (
    <AdminAssistantContext.Provider value={value}>
      {children}
      <style>{`
        .ask-crm-drawer .ant-drawer-header {
          display: none;
        }
        .ask-crm-drawer .ant-drawer-body {
          padding: 0 !important;
          height: 100%;
          background: #f4f6f9;
        }
        .ask-crm-shell {
          display: flex;
          height: 100%;
          min-height: 100%;
          position: relative;
          overflow: hidden;
          font-family: inherit;
        }
        .ask-crm-history {
          width: 260px;
          flex: 0 0 260px;
          background: #0f172a;
          color: #e2e8f0;
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255,255,255,0.06);
          z-index: 2;
        }
        .ask-crm-history__top {
          padding: 14px 12px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .ask-crm-history__new {
          width: 100%;
          height: 40px;
          border-radius: 10px !important;
          background: #339393 !important;
          border-color: #339393 !important;
          font-weight: 600;
        }
        .ask-crm-history__new:hover {
          background: #2a7d7d !important;
          border-color: #2a7d7d !important;
        }
        .ask-crm-history__list {
          flex: 1;
          overflow-y: auto;
          padding: 10px 8px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ask-crm-history__label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #94a3b8;
          padding: 8px 10px 6px;
        }
        .ask-crm-history-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          width: 100%;
          text-align: left;
          border: none;
          background: transparent;
          color: #e2e8f0;
          border-radius: 10px;
          padding: 10px 10px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .ask-crm-history-item:hover {
          background: rgba(255,255,255,0.06);
        }
        .ask-crm-history-item.is-active {
          background: rgba(51,147,147,0.22);
        }
        .ask-crm-history-item__body {
          flex: 1;
          min-width: 0;
        }
        .ask-crm-history-item__title {
          font-size: 13px;
          font-weight: 500;
          line-height: 1.35;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ask-crm-history-item__meta {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .ask-crm-history-item__delete {
          opacity: 0;
          color: #94a3b8 !important;
          flex-shrink: 0;
        }
        .ask-crm-history-item:hover .ask-crm-history-item__delete,
        .ask-crm-history-item.is-active .ask-crm-history-item__delete {
          opacity: 1;
        }
        .ask-crm-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #f8fafc 0%, #eef1f6 100%);
        }
        .ask-crm-main__header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          background: rgba(255,255,255,0.92);
          border-bottom: 1px solid #e2e8f0;
          backdrop-filter: blur(8px);
        }
        .ask-crm-main__title {
          margin: 0 !important;
          font-size: 16px !important;
          font-weight: 650 !important;
          color: #0f172a;
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ask-crm-messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px 20px 12px;
        }
        .ask-crm-messages__inner {
          max-width: 760px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 100%;
        }
        .ask-crm-empty {
          margin: auto;
          text-align: center;
          padding: 32px 12px 48px;
          max-width: 520px;
        }
        .ask-crm-empty__icon {
          width: 88px;
          height: 88px;
          margin: 0 auto 14px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
        }
        .ask-crm-empty__icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ask-crm-fab {
          overflow: hidden !important;
        }
        .ask-crm-fab img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .ask-crm-fab.ant-btn > span {
          display: flex !important;
          width: 100%;
          height: 100%;
        }
        .ask-crm-empty__title {
          margin: 0 0 8px !important;
          font-size: 22px !important;
          color: #0f172a;
        }
        .ask-crm-empty__text {
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 20px;
        }
        .ask-crm-suggestions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        @media (max-width: 640px) {
          .ask-crm-suggestions {
            grid-template-columns: 1fr;
          }
        }
        .ask-crm-chip {
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 12px;
          padding: 12px 14px;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
          color: #334155;
          line-height: 1.4;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        }
        .ask-crm-chip:hover {
          border-color: #339393;
          box-shadow: 0 4px 14px rgba(51,147,147,0.12);
          transform: translateY(-1px);
        }
        .ask-crm-bubble {
          max-width: 88%;
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 14px;
          line-height: 1.5;
          overflow: hidden;
          animation: askCrmIn 0.18s ease;
        }
        .ask-crm-bubble--user {
          align-self: flex-end;
          background: #339393;
          color: #fff;
          border-bottom-right-radius: 4px;
          white-space: pre-wrap;
          box-shadow: 0 6px 16px rgba(51,147,147,0.25);
        }
        .ask-crm-bubble--assistant {
          align-self: flex-start;
          background: #fff;
          color: #0f172a;
          border: 1px solid #e2e8f0;
          border-bottom-left-radius: 4px;
          box-shadow: 0 1px 3px rgba(15,23,42,0.05);
        }
        .ask-crm-typing {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          color: #64748b;
          font-size: 13px;
        }
        .ask-crm-composer {
          padding: 12px 20px 20px;
          background: linear-gradient(180deg, transparent, #eef1f6 28%);
        }
        .ask-crm-composer__inner {
          max-width: 760px;
          margin: 0 auto;
          display: flex;
          gap: 10px;
          align-items: flex-end;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 10px 10px 10px 14px;
          box-shadow: 0 8px 28px rgba(15,23,42,0.08);
        }
        .ask-crm-composer__inner .ant-input {
          border: none !important;
          box-shadow: none !important;
          resize: none;
          padding: 6px 0 !important;
          background: transparent !important;
          font-size: 14px;
        }
        .ask-crm-composer__send {
          flex-shrink: 0;
          height: 40px !important;
          width: 40px !important;
          min-width: 40px !important;
          border-radius: 12px !important;
          background: #339393 !important;
          border-color: #339393 !important;
        }
        .ask-crm-composer__send:hover {
          background: #2a7d7d !important;
          border-color: #2a7d7d !important;
        }
        .ask-crm-composer__hint {
          max-width: 760px;
          margin: 8px auto 0;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
        }
        .ask-crm-composer__close {
          display: flex;
          justify-content: center;
          max-width: 760px;
          margin: 12px auto 0;
        }
        .ask-crm-composer__close .ant-btn {
          min-width: 120px;
          height: 36px;
          border-radius: 10px;
          border-color: #339393;
          color: #0d5c5c;
          font-weight: 600;
        }
        .ask-crm-composer__close .ant-btn:hover {
          border-color: #2a7d7d !important;
          color: #0d5c5c !important;
          background: rgba(51, 147, 147, 0.08) !important;
        }
        .ask-crm-history-overlay {
          position: absolute;
          inset: 0;
          background: rgba(15,23,42,0.35);
          z-index: 1;
        }
        .ask-crm-history--mobile {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          box-shadow: 8px 0 30px rgba(15,23,42,0.25);
        }
        .ask-crm-md { font-size: 14px; line-height: 1.5; }
        .ask-crm-md > :first-child { margin-top: 0; }
        .ask-crm-md > :last-child { margin-bottom: 0; }
        .ask-crm-md p, .ask-crm-md ul, .ask-crm-md ol { margin: 0 0 8px; }
        .ask-crm-md ul, .ask-crm-md ol { padding-left: 18px; }
        .ask-crm-md li { margin-bottom: 2px; }
        .ask-crm-md__link {
          color: #339393;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: pointer;
        }
        .ask-crm-md__link:hover {
          color: #2a7d7d;
        }
        .ask-crm-md h1, .ask-crm-md h2, .ask-crm-md h3, .ask-crm-md h4 {
          margin: 10px 0 6px; font-size: 14px; font-weight: 600;
        }
        .ask-crm-md h1:first-child, .ask-crm-md h2:first-child, .ask-crm-md h3:first-child {
          margin-top: 0;
        }
        .ask-crm-md strong { font-weight: 600; }
        .ask-crm-table-wrap {
          overflow-x: auto;
          max-width: 100%;
          margin: 8px 0;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          background: #fff;
        }
        .ask-crm-table-wrap table {
          border-collapse: collapse;
          width: max-content;
          min-width: 100%;
          font-size: 12px;
        }
        .ask-crm-table-wrap th,
        .ask-crm-table-wrap td {
          border: 1px solid #eee;
          padding: 6px 8px;
          text-align: left;
          white-space: nowrap;
        }
        .ask-crm-table-wrap th {
          background: #fafafa;
          font-weight: 600;
        }
        .ask-crm-email-draft {
          margin-top: 12px;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #f0c36d;
          background: #fffbeb;
        }
        .ask-crm-email-draft--sent {
          border-color: #86efac;
          background: #f0fdf4;
        }
        .ask-crm-email-draft--cancelled,
        .ask-crm-email-draft--failed {
          border-color: #e2e8f0;
          background: #f8fafc;
        }
        .ask-crm-email-draft__badge {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #b45309;
          margin-bottom: 8px;
        }
        .ask-crm-email-draft--sent .ask-crm-email-draft__badge {
          color: #15803d;
        }
        .ask-crm-email-draft__row {
          display: flex;
          gap: 8px;
          font-size: 13px;
          margin-bottom: 4px;
          color: #0f172a;
        }
        .ask-crm-email-draft__row--edit {
          align-items: center;
        }
        .ask-crm-email-draft__row--edit .ant-input {
          flex: 1;
        }
        .ask-crm-email-draft__label {
          flex: 0 0 58px;
          color: #64748b;
          font-weight: 600;
        }
        .ask-crm-email-draft__body {
          margin-top: 8px;
          padding: 10px;
          border-radius: 8px;
          background: #fff;
          border: 1px solid #fde68a;
          white-space: pre-wrap;
          font-size: 13px;
          line-height: 1.45;
          color: #334155;
          max-height: 180px;
          overflow-y: auto;
        }
        .ask-crm-email-draft__body-input {
          margin-top: 8px !important;
          font-size: 13px;
          line-height: 1.45;
        }
        .ask-crm-email-draft__actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 12px;
        }
        .ask-crm-email-draft__meta {
          margin-top: 8px;
          font-size: 12px;
          color: #64748b;
        }
        @keyframes askCrmIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <Button
        type="primary"
        aria-label="Ask CRM"
        className="ask-crm-fab"
        onClick={openDrawer}
        style={{
          position: "fixed",
          right: 28,
          bottom: 28,
          zIndex: 1100,
          width: 72,
          height: 72,
          minWidth: 72,
          borderRadius: "50%",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          borderColor: "#e2e8f0",
          boxShadow: "0 6px 24px rgba(15, 23, 42, 0.18)",
        }}
      >
        <AskCrmIcon size={72} style={{ borderRadius: "50%" }} />
      </Button>
      <Drawer
        className="ask-crm-drawer"
        title={null}
        placement="right"
        width={drawerWidth}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose={false}
        zIndex={1200}
        closable={false}
        styles={{ body: { padding: 0, height: "100%" }, header: { display: "none" } }}
      >
        <div className="ask-crm-shell">
          {isMobile && historyOpen && (
            <button
              type="button"
              className="ask-crm-history-overlay"
              aria-label="Close history"
              onClick={() => setHistoryOpen(false)}
            />
          )}

          {showHistory && (
            <aside className={`ask-crm-history ${isMobile ? "ask-crm-history--mobile" : ""}`}>
              <div className="ask-crm-history__top">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  className="ask-crm-history__new"
                  onClick={startNewChat}
                >
                  New chat
                </Button>
              </div>
              <div className="ask-crm-history__list">
                <div className="ask-crm-history__label">History</div>
                {conversations.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    className={`ask-crm-history-item ${c.id === activeId ? "is-active" : ""}`}
                    onClick={() => selectChat(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectChat(c.id);
                      }
                    }}
                  >
                    <div className="ask-crm-history-item__body">
                      <div className="ask-crm-history-item__title">{c.title}</div>
                      <div className="ask-crm-history-item__meta">
                        {formatRelativeTime(c.updatedAt)}
                        {c.messages?.length ? ` · ${c.messages.length} msgs` : ""}
                      </div>
                    </div>
                    <Tooltip title="Delete">
                      <Button
                        type="text"
                        size="small"
                        className="ask-crm-history-item__delete"
                        icon={<DeleteOutlined />}
                        onClick={(e) => deleteChat(c.id, e)}
                      />
                    </Tooltip>
                  </div>
                ))}
              </div>
            </aside>
          )}

          <section className="ask-crm-main">
            <header className="ask-crm-main__header">
              {isMobile && (
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  aria-label="Open history"
                  onClick={() => setHistoryOpen(true)}
                />
              )}
              <Title level={4} className="ask-crm-main__title">
                {activeConversation?.title || "Ask CRM"}
              </Title>
              <Button type="text" onClick={() => setOpen(false)}>
                Close
              </Button>
            </header>

            <div className="ask-crm-messages" ref={listRef}>
              <div className="ask-crm-messages__inner">
                {messages.length === 0 ? (
                  <div className="ask-crm-empty">
                    <div className="ask-crm-empty__icon">
                      <AskCrmIcon size={88} />
                    </div>
                    <Title level={3} className="ask-crm-empty__title">
                      Ask CRM
                    </Title>
                    <div className="ask-crm-empty__text">{WELCOME}</div>
                    <div className="ask-crm-suggestions">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="ask-crm-chip"
                          disabled={loading}
                          onClick={() => send(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div
                      key={`${activeId}-${m.role}-${i}`}
                      className={`ask-crm-bubble ask-crm-bubble--${m.role === "user" ? "user" : "assistant"}`}
                    >
                      {m.role === "assistant" ? (
                        <>
                          <AssistantMessage
                            content={m.content}
                            onNavigate={handleInternalNavigate}
                            onExportDownload={handleExportDownload}
                          />
                          {(m.emailDrafts || []).map((draft) => (
                            <EmailDraftCard
                              key={draft.draftId}
                              draft={draft}
                              onUpdated={(next) =>
                                updateMessageDraft(i, draft.draftId, next)
                              }
                            />
                          ))}
                        </>
                      ) : (
                        m.content
                      )}
                    </div>
                  ))
                )}
                {loading && (
                  <div className="ask-crm-typing">
                    <Spin size="small" />{" "}
                    {streamStatus === "looking_up"
                      ? "Looking up…"
                      : messages[messages.length - 1]?.streaming &&
                          messages[messages.length - 1]?.content
                        ? "Writing…"
                        : "Thinking…"}
                  </div>
                )}
              </div>
            </div>

            <div className="ask-crm-composer">
              <div className="ask-crm-composer__inner">
                <Input.TextArea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question…"
                  autoSize={{ minRows: 1, maxRows: 5 }}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  disabled={loading}
                />
                <Button
                  type="primary"
                  className="ask-crm-composer__send"
                  icon={<SendOutlined />}
                  onClick={() => send()}
                  loading={loading}
                  disabled={!input.trim()}
                  aria-label="Send"
                />
              </div>
              <div className="ask-crm-composer__hint">
                History stays on this device for 5 minutes · Enter to send · Shift+Enter for new line
              </div>
              <div className="ask-crm-composer__close">
                <Button icon={<CloseOutlined />} onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </section>
        </div>
      </Drawer>
    </AdminAssistantContext.Provider>
  );
}
