import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { getJobs } from "../Jobs/jobApi";
import { getCustomerNotificationReceipts } from "./notificationApi";

const { Title, Text } = Typography;
const { Option } = Select;

const TYPE_COLORS = {
  eta: "blue",
  workflow: "purple",
  general: "default",
  appointment_reminder: "orange",
  invoice_reminder: "red",
};

export default function NotificationReceipts() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({
    jobId: undefined,
    read: "all",
  });

  const loadJobs = async () => {
    try {
      const list = await getJobs();
      setJobs(Array.isArray(list) ? list : []);
    } catch {
      setJobs([]);
    }
  };

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.jobId) params.jobId = filters.jobId;
      if (filters.read === "read") params.read = "true";
      if (filters.read === "unread") params.read = "false";

      const result = await getCustomerNotificationReceipts(params);
      setItems(Array.isArray(result?.items) ? result.items : []);
      setUnreadCount(Number(result?.unreadCount || 0));
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load notification receipts");
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const summary = useMemo(() => {
    const read = items.filter((item) => item.read).length;
    return { total: items.length, read, unread: items.length - read };
  }, [items]);

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ marginBottom: 4 }}>
        Customer Notification Read Receipts
      </Title>
      <Text type="secondary">
        Track whether clients have opened ETA, workflow, and progress notifications (last 24 hours).
      </Text>

      <Card style={{ marginTop: 16, marginBottom: 16 }}>
        <Space wrap size="large">
          <div>
            <Text strong>Job</Text>
            <Select
              allowClear
              showSearch
              placeholder="All jobs"
              style={{ width: 260, display: "block", marginTop: 8 }}
              value={filters.jobId}
              onChange={(value) => setFilters((prev) => ({ ...prev, jobId: value }))}
              optionFilterProp="children"
            >
              {jobs.map((job) => (
                <Option key={job._id} value={job._id}>
                  {job.jobId} — {job.customer || "No customer"}
                </Option>
              ))}
            </Select>
          </div>
          <div>
            <Text strong>Read status</Text>
            <Select
              style={{ width: 180, display: "block", marginTop: 8 }}
              value={filters.read}
              onChange={(value) => setFilters((prev) => ({ ...prev, read: value }))}
              options={[
                { value: "all", label: "All" },
                { value: "unread", label: "Unread only" },
                { value: "read", label: "Read only" },
              ]}
            />
          </div>
          <div>
            <Text strong>Summary</Text>
            <div style={{ marginTop: 8 }}>
              <Tag color="blue">Total: {summary.total}</Tag>
              <Tag color="green">Read: {summary.read}</Tag>
              <Tag color="orange">Unread: {unreadCount}</Tag>
            </div>
          </div>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={items}
          pagination={{ pageSize: 15 }}
          scroll={{ x: 1100 }}
          columns={[
            {
              title: "Sent",
              dataIndex: "createdAt",
              width: 150,
              render: (v) => (v ? dayjs(v).format("DD MMM HH:mm") : "—"),
            },
            {
              title: "Customer",
              width: 180,
              render: (_, row) =>
                row.customerId?.name ||
                row.customerId?.email ||
                row.customerId?.company ||
                "—",
            },
            {
              title: "Job",
              width: 130,
              render: (_, row) => row.jobId?.jobId || "—",
            },
            {
              title: "Type",
              dataIndex: "type",
              width: 120,
              render: (value) => (
                <Tag color={TYPE_COLORS[value] || "default"}>{value || "general"}</Tag>
              ),
            },
            { title: "Title", dataIndex: "title", ellipsis: true },
            {
              title: "Read",
              dataIndex: "read",
              width: 90,
              render: (read) =>
                read ? <Tag color="green">Yes</Tag> : <Tag color="orange">No</Tag>,
            },
            {
              title: "Read at",
              dataIndex: "readAt",
              width: 150,
              render: (v) => (v ? dayjs(v).format("DD MMM HH:mm") : "—"),
            },
          ]}
        />
      </Card>
    </div>
  );
}
