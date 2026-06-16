import { useEffect, useMemo, useState } from "react";
import { Card, Table, Tag, Input, Button, message } from "antd";
import { useNavigate } from "react-router-dom";
import { customerGetProjects } from "../customerApi";

const stateColor = (value) => {
  const s = String(value || "").toLowerCase();

  if (s.includes("new")) return "blue";
  if (s.includes("active")) return "processing";
  if (s.includes("completed")) return "success";
  if (s.includes("closed")) return "default";
  return "default";
};

const typeColor = (value) => {
  const s = String(value || "").toLowerCase();
  if (s.includes("commercial")) return "purple";
  if (s.includes("residential")) return "green";
  return "default";
};

export default function CustomerProjects() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [q, setQ] = useState("");

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await customerGetProjects();
      setProjects(Array.isArray(res) ? res : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to fetch projects"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return projects;

    return projects.filter((p) => {
      const jobId = String(p?.jobId || "").toLowerCase();
      const state = String(p?.systemState || "").toLowerCase();
      const type = String(p?.projectType || p?.categoryCode || "").toLowerCase();
      const address = String(p?.address || p?.site || "").toLowerCase();
      const customer = String(p?.customer || "").toLowerCase();

      return (
        jobId.includes(query) ||
        state.includes(query) ||
        type.includes(query) ||
        address.includes(query) ||
        customer.includes(query)
      );
    });
  }, [projects, q]);

  const columns = [
    {
      title: "Project ID",
      dataIndex: "jobId",
      key: "jobId",
      render: (v) => v || "—",
    },
    {
      title: "Type",
      dataIndex: "projectType",
      key: "projectType",
      render: (_, row) => {
        const value = row?.projectType || row?.categoryCode || "—";
        return <Tag color={typeColor(value)}>{value}</Tag>;
      },
    },
    {
      title: "Address",
      key: "address",
      render: (_, row) => row?.address || row?.site || "—",
    },
    {
      title: "State",
      dataIndex: "systemState",
      key: "systemState",
      render: (v) => <Tag color={stateColor(v)}>{v || "New"}</Tag>,
    },
    {
      title: "Last Update",
      key: "updatedAt",
      render: (_, row) => {
        const d = row?.updatedAt || row?.createdAt;
        if (!d) return "—";
        return new Date(d).toLocaleString();
      },
    },
    {
      title: "Action",
      key: "action",
      render: (_, row) => (
        <Button type="link" onClick={() => navigate(`/portal/projects/${row?._id}`)}>
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="My Projects"
        extra={
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by project id, type, address, state..."
            style={{ width: 340 }}
            allowClear
          />
        }
      >
        <Table
          rowKey={(r) => r?._id}
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}