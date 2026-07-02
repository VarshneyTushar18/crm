import { useEffect, useState } from "react";
import { Card, Table, Tag, Button, message } from "antd";
import { FileOutlined, EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { customerGetDocuments } from "../customerApi";
import { buildFileUrl } from "@/config/serverApiConfig";
import { useNavigate } from "react-router-dom";

const typeColor = (type) => {
  if (type === "Drawing") return "blue";
  if (type === "Site Photo") return "green";
  if (type === "Quote") return "gold";
  return "default";
};

export default function CustomerDocuments() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await customerGetDocuments();
        setDocuments(Array.isArray(res) ? res : []);
      } catch (err) {
        message.error("Failed to load documents");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const columns = [
    { title: "Type", dataIndex: "type", render: (t) => <Tag color={typeColor(t)}>{t}</Tag> },
    { title: "Title", dataIndex: "title" },
    { title: "Project", dataIndex: "jobCode", render: (v) => v || "—" },
    { title: "Revision", dataIndex: "revision", render: (v) => v || "—" },
    {
      title: "Updated",
      dataIndex: "updatedAt",
      render: (v) => (v ? dayjs(v).format("DD MMM YYYY") : "—"),
    },
    {
      title: "Action",
      render: (_, row) => {
        if (row.type === "Quote") {
          return (
            <Button type="link" onClick={() => navigate(`/portal/quotes/${row._id}`)}>
              View Quote
            </Button>
          );
        }
        if (row.fileUrl) {
          return (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => window.open(buildFileUrl(row.fileUrl), "_blank")}
            >
              Open
            </Button>
          );
        }
        return <Tag icon={<FileOutlined />}>No file</Tag>;
      },
    },
  ];

  return (
    <Card title="My Documents">
      <Table
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={documents}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: "No documents available yet for your projects." }}
      />
    </Card>
  );
}
