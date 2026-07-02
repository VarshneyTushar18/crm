import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Upload, message, Tag, Space } from "antd";
import { PaperClipOutlined, SendOutlined } from "@ant-design/icons";
import { buildFileUrl } from "@/config/serverApiConfig";
import { createJobComment, getJobComments } from "@/api/extensionApi";

const roleColor = (role) => {
  switch (String(role || "").toLowerCase()) {
    case "admin":
      return "blue";
    case "siteengineer":
      return "purple";
    case "worker":
      return "green";
    default:
      return "default";
  }
};

export default function JobChatPanel({ jobId, jobLabel = "", pollMs = 30000 }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [fileList, setFileList] = useState([]);
  const bottomRef = useRef(null);

  const loadComments = useCallback(async (silent = false) => {
    if (!jobId) return;
    if (!silent) setLoading(true);
    try {
      const thread = await getJobComments(jobId);
      setComments(Array.isArray(thread) ? thread : []);
    } catch {
      if (!silent) setComments([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadComments();
    if (!jobId || !pollMs) return undefined;
    const timer = setInterval(() => loadComments(true), pollMs);
    return () => clearInterval(timer);
  }, [jobId, pollMs, loadComments]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const submit = async () => {
    if (!jobId) return;
    if (!text.trim() && fileList.length === 0) {
      message.warning("Enter a message or attach a file");
      return;
    }

    try {
      setSaving(true);
      const files = fileList.map((f) => f.originFileObj).filter(Boolean);
      await createJobComment(jobId, text.trim() || "Shared an attachment", files);
      setText("");
      setFileList([]);
      await loadComments(true);
      message.success("Posted to team chat");
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to post comment");
    } finally {
      setSaving(false);
    }
  };

  if (!jobId) {
    return <div style={{ color: "#888", fontSize: 13 }}>Select a job to open team chat.</div>;
  }

  return (
    <div>
      {jobLabel ? (
        <div style={{ marginBottom: 10, fontSize: 12, color: "#666" }}>
          Job thread: <strong>{jobLabel}</strong>
        </div>
      ) : null}

      <div
        style={{
          maxHeight: 320,
          overflowY: "auto",
          marginBottom: 12,
          padding: "4px 2px",
          border: "1px solid #f0f0f0",
          borderRadius: 8,
          background: "#fafafa",
        }}
      >
        {loading && comments.length === 0 ? (
          <div style={{ padding: 16, color: "#888", fontSize: 13 }}>Loading chat...</div>
        ) : comments.length === 0 ? (
          <div style={{ padding: 16, color: "#888", fontSize: 13 }}>No messages yet. Start the conversation.</div>
        ) : (
          comments.map((c) => (
            <div
              key={c._id}
              style={{
                margin: "8px 10px",
                padding: "10px 12px",
                background: "#fff",
                borderRadius: 8,
                border: "1px solid #f0f0f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.authorName || "User"}</span>
                <Tag color={roleColor(c.authorRole)} style={{ margin: 0, fontSize: 10 }}>
                  {c.authorRole || "staff"}
                </Tag>
                <span style={{ fontSize: 11, color: "#999", marginLeft: "auto" }}>
                  {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                </span>
              </div>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{c.message}</div>
              {Array.isArray(c.attachments) && c.attachments.length > 0 ? (
                <Space wrap style={{ marginTop: 8 }}>
                  {c.attachments.map((file, idx) => (
                    <a
                      key={`${c._id}-${idx}`}
                      href={buildFileUrl(file.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12 }}
                    >
                      <PaperClipOutlined /> {file.originalName || "Attachment"}
                    </a>
                  ))}
                </Space>
              ) : null}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <Input.TextArea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share an update with admin, site engineer, and field team..."
        onPressEnter={(e) => {
          if (!e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />

      <div
        style={{
          marginTop: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Upload
          multiple
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: next }) => setFileList(next.slice(-5))}
          accept="image/*,.pdf,.doc,.docx,video/mp4,video/quicktime,video/webm"
        >
          <Button icon={<PaperClipOutlined />} size="small">
            Attach file
          </Button>
        </Upload>

        <Button
          type="primary"
          size="small"
          icon={<SendOutlined />}
          loading={saving}
          onClick={submit}
        >
          Post
        </Button>
      </div>
    </div>
  );
}
