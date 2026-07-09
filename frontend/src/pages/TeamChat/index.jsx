import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  List,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { MessageOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import JobChatPanel from "@/components/JobChatPanel";
import { getTeamChatInbox } from "@/api/extensionApi";

const { Title, Text } = Typography;

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

const SEEN_KEY = "crmTeamChatSeen";

const formatWhen = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
};

const readSeenMap = () => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

const writeSeenMap = (map) => {
  localStorage.setItem(SEEN_KEY, JSON.stringify(map));
};

const isUnreadThread = (item, seenMap) => {
  if (!item?.lastAt) return false;
  const seenAt = seenMap[String(item.jobId)];
  if (!seenAt) return true;
  return new Date(item.lastAt).getTime() > new Date(seenAt).getTime();
};

export default function TeamChatDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedJobId = searchParams.get("jobId") || "";

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [seenMap, setSeenMap] = useState(() => readSeenMap());

  const markSeen = useCallback((jobId, lastAt) => {
    if (!jobId) return;
    const key = String(jobId);
    const stamp = lastAt ? new Date(lastAt).toISOString() : new Date().toISOString();
    setSeenMap((prev) => {
      const next = { ...prev, [key]: stamp };
      writeSeenMap(next);
      return next;
    });
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await getTeamChatInbox({ limit: 150 });
      const rows = Array.isArray(list) ? list : [];
      setThreads(rows);

      // First visit: baseline all current threads as seen so only *new* messages go red
      setSeenMap((prev) => {
        if (Object.keys(prev).length) return prev;
        const baseline = {};
        rows.forEach((t) => {
          if (t?.jobId && t?.lastAt) {
            baseline[String(t.jobId)] = new Date(t.lastAt).toISOString();
          }
        });
        if (Object.keys(baseline).length) writeSeenMap(baseline);
        return baseline;
      });
    } catch (err) {
      if (!silent) {
        message.error(err?.response?.data?.message || "Failed to load chats");
      }
      setThreads([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 20000);
    return () => clearInterval(timer);
  }, [load]);

  // Opening a thread clears the red "new" state for that job
  useEffect(() => {
    if (!selectedJobId) return;
    const thread = threads.find((t) => String(t.jobId) === String(selectedJobId));
    if (thread) markSeen(thread.jobId, thread.lastAt || new Date().toISOString());
  }, [selectedJobId, threads, markSeen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const hay = [
        t.jobCode,
        t.customer,
        t.site,
        t.lastMessage,
        t.lastAuthorName,
        t.lastAuthorRole,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [threads, query]);

  const selected = useMemo(
    () => threads.find((t) => String(t.jobId) === String(selectedJobId)) || null,
    [threads, selectedJobId]
  );

  const openThread = (jobId) => {
    setSearchParams(jobId ? { jobId: String(jobId) } : {});
  };

  return (
    <div className="page-shell">
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
        wrap
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <MessageOutlined style={{ marginRight: 8 }} />
            Team Chat
          </Title>
          <Text type="secondary">
            All job conversations from workers, site engineers, and admins — open any thread.
          </Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load()}>
            Refresh
          </Button>
        </Space>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card
            title={`All chats (${filtered.length})`}
            extra={
              <Input.Search
                allowClear
                placeholder="Search job / person / message"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: 220 }}
              />
            }
            styles={{ body: { padding: 0 } }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: 24 }}>
                <Empty
                  description={
                    loading ? "Loading chats..." : "No team chats yet across jobs"
                  }
                />
              </div>
            ) : (
              <List
                loading={loading}
                dataSource={filtered}
                style={{ maxHeight: "70vh", overflowY: "auto" }}
                renderItem={(item) => {
                  const active = String(item.jobId) === String(selectedJobId);
                  const unread = !active && isUnreadThread(item, seenMap);
                  return (
                    <List.Item
                      onClick={() => openThread(item.jobId)}
                      style={{
                        cursor: "pointer",
                        padding: "12px 16px",
                        background: active
                          ? "#e6f4ff"
                          : unread
                            ? "#fff1f0"
                            : "transparent",
                        borderLeft: active
                          ? "3px solid #1677ff"
                          : unread
                            ? "3px solid #ff4d4f"
                            : "3px solid transparent",
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <Space wrap size={6}>
                            <span
                              style={{
                                fontWeight: unread ? 700 : 600,
                                color: unread ? "#cf1322" : undefined,
                              }}
                            >
                              {item.jobCode || "Job"}
                            </span>
                            <Tag color={unread ? "red" : "default"}>
                              {unread ? "New" : `${item.messageCount} msg`}
                            </Tag>
                            {item.lastAuthorRole ? (
                              <Tag color={roleColor(item.lastAuthorRole)}>
                                {item.lastAuthorRole}
                              </Tag>
                            ) : null}
                          </Space>
                        }
                        description={
                          <div>
                            <div style={{ color: "#666", fontSize: 12 }}>
                              {[item.customer, item.site].filter(Boolean).join(" · ") || "—"}
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 13,
                                color: unread ? "#a8071a" : "#333",
                                fontWeight: unread ? 600 : 400,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <strong>{item.lastAuthorName || "Someone"}:</strong>{" "}
                              {item.lastMessage ||
                                (item.hasAttachment ? "Shared an attachment" : "—")}
                            </div>
                            <div style={{ marginTop: 4, fontSize: 11, color: "#999" }}>
                              {formatWhen(item.lastAt)}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card
            title={
              selected
                ? `Chat — ${selected.jobCode}`
                : "Select a chat"
            }
            extra={
              selected ? (
                <Button
                  type="link"
                  onClick={() => navigate(`/admin/job/${selected.jobId}`)}
                >
                  Open job
                </Button>
              ) : null
            }
          >
            {selectedJobId ? (
              <JobChatPanel
                jobId={selectedJobId}
                jobLabel={selected?.jobCode || ""}
                pollMs={15000}
              />
            ) : (
              <Empty description="Pick a conversation from the left to view all messages from anyone on that job" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
