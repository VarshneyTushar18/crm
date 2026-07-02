import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Dropdown, List, Typography, notification } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/api/extensionApi";

const { Text } = Typography;

const formatWhen = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [api, contextHolder] = notification.useNotification();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const popupShownRef = useRef(new Set());

  const applyList = useCallback((data) => {
    const list = data?.items || [];
    setItems(list);
    setUnreadCount(Number(data?.unreadCount || 0));
    return list;
  }, []);

  const showPopupForUnread = useCallback(
    (list = []) => {
      const unread = list.filter((item) => item?._id && !item.read);
      unread.slice(0, 3).forEach((item) => {
        if (popupShownRef.current.has(item._id)) return;
        popupShownRef.current.add(item._id);

        api.info({
          key: item._id,
          message: item.title || "New notification",
          description: item.body || "",
          placement: "topRight",
          duration: 6,
          onClick: async () => {
            try {
              if (!item.read) {
                await markNotificationRead(item._id);
              }
            } catch {
              // Ignore read-mark failure for popup click.
            }
            if (item.link) {
              navigate(item.link);
              setOpen(false);
            }
            load({ silent: true });
          },
        });
      });
    },
    [api, navigate]
  );

  const load = useCallback(
    async ({ silent = false, showPopups = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const data = await getNotifications();
        const list = applyList(data);
        if (showPopups) {
          showPopupForUnread(list);
        }
        return data;
      } catch {
        setItems([]);
        setUnreadCount(0);
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [applyList, showPopupForUnread]
  );

  useEffect(() => {
    load({ showPopups: true });
    const timer = setInterval(() => load({ silent: true, showPopups: true }), 60000);
    return () => clearInterval(timer);
  }, [load]);

  const onOpenChange = async (nextOpen) => {
    setOpen(nextOpen);

    if (!nextOpen) return;

    const data = await load({ silent: true });
    const unread = (data?.items || []).filter((item) => !item.read);

    if (unread.length > 0) {
      const seenAt = new Date().toISOString();
      setItems((prev) =>
        prev.map((item) =>
          item.read ? item : { ...item, read: true, readAt: seenAt }
        )
      );
      setUnreadCount(0);
      unread.forEach((item) => {
        if (item?._id) popupShownRef.current.add(item._id);
      });

      try {
        await markAllNotificationsRead();
      } catch {
        await load({ silent: true });
      }
    }
  };

  const handleClick = async (item) => {
    if (!item.read) {
      try {
        await markNotificationRead(item._id);
        await load({ silent: true });
      } catch {
        // Ignore single read failure.
      }
    }
    if (item.link) {
      navigate(item.link);
      setOpen(false);
    }
  };

  const overlay = (
    <div
      style={{
        width: 340,
        maxHeight: 380,
        overflow: "auto",
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        padding: 8,
      }}
    >
      <div
        style={{
          padding: "4px 8px 8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600 }}>Notifications</span>
        {unreadCount > 0 ? (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {unreadCount} unread
          </Text>
        ) : null}
      </div>

      {items.length === 0 ? (
        <Text type="secondary" style={{ padding: 8, display: "block" }}>
          {loading ? "Loading..." : "No notifications"}
        </Text>
      ) : (
        <List
          size="small"
          dataSource={items.slice(0, 20)}
          renderItem={(item) => (
            <List.Item
              style={{
                cursor: item.link ? "pointer" : "default",
                background: item.read ? "transparent" : "#f6ffed",
                borderRadius: 6,
                padding: "8px 10px",
              }}
              onClick={() => handleClick(item)}
            >
              <List.Item.Meta
                title={<span style={{ fontSize: 13 }}>{item.title}</span>}
                description={
                  <span style={{ fontSize: 12, color: "#666" }}>
                    {item.body}
                    <span style={{ display: "block", marginTop: 4, fontSize: 11, color: "#999" }}>
                      {item.readAt
                        ? `Seen ${formatWhen(item.readAt)}`
                        : `Received ${formatWhen(item.createdAt)}`}
                    </span>
                  </span>
                }
              />
            </List.Item>
          )}
        />
      )}

      <Text type="secondary" style={{ display: "block", fontSize: 11, padding: "8px 8px 4px" }}>
        Notifications stay for 24 hours, then refresh automatically.
      </Text>
    </div>
  );

  return (
    <>
      {contextHolder}
      <Dropdown
        open={open}
        onOpenChange={onOpenChange}
        dropdownRender={() => overlay}
        trigger={["click"]}
        placement="bottomRight"
      >
        <Button type="text" aria-label="Notifications">
          <Badge count={unreadCount} size="small" overflowCount={99}>
            <BellOutlined style={{ fontSize: 18 }} />
          </Badge>
        </Button>
      </Dropdown>
    </>
  );
}
