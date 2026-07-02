import { useEffect, useMemo, useState } from "react";
import { Card, Table, Tag, Input, Button, message } from "antd";
import { useNavigate } from "react-router-dom";
import { customerGetQuotes } from "../customerApi";
import dayjs from "dayjs";

const statusColor = (status) => {
  switch (status) {
    case "Accepted":
      return "success";
    case "Sent":
      return "processing";
    case "Rejected":
      return "error";
    default:
      return "default";
  }
};

export default function CustomerQuotes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [q, setQ] = useState("");

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const res = await customerGetQuotes();
      setQuotes(Array.isArray(res) ? res : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to fetch quotes"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return quotes;

    return quotes.filter((item) => {
      const quoteNumber = String(item?.quoteNumber || "").toLowerCase();
      const jobCode = String(item?.jobCode || "").toLowerCase();
      const site = String(item?.siteAddress || "").toLowerCase();
      const status = String(item?.status || "").toLowerCase();

      return (
        quoteNumber.includes(query) ||
        jobCode.includes(query) ||
        site.includes(query) ||
        status.includes(query)
      );
    });
  }, [quotes, q]);

  const columns = [
    {
      title: "Quote #",
      dataIndex: "quoteNumber",
      key: "quoteNumber",
      render: (v) => v || "—",
    },
    {
      title: "Project",
      dataIndex: "jobCode",
      key: "jobCode",
      render: (v) => v || "—",
    },
    {
      title: "Site",
      dataIndex: "siteAddress",
      key: "siteAddress",
      ellipsis: true,
      render: (v) => v || "—",
    },
    {
      title: "Amount",
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (v) => `₹ ${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    },
    {
      title: "Valid Until",
      dataIndex: "validUntil",
      key: "validUntil",
      render: (v) => (v ? dayjs(v).format("DD MMM YYYY") : "—"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => <Tag color={statusColor(status)}>{status || "—"}</Tag>,
    },
    {
      title: "Action",
      key: "action",
      render: (_, row) => (
        <Button type="link" onClick={() => navigate(`/portal/quotes/${row._id}`)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <Card
      title="My Quotes"
      extra={
        <Input.Search
          allowClear
          placeholder="Search quote, project, site..."
          style={{ width: 260 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      }
    >
      <Table
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: "No quotes yet. Quotes appear here after your project is created." }}
      />
    </Card>
  );
}
