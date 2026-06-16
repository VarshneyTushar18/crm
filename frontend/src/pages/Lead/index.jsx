import { useEffect, useState } from "react";
import { Button, Table, Space, Popconfirm, Select, Tag, message } from "antd";
import { useNavigate } from "react-router-dom";

import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import LeadForm from "./LeadForm";
import { getLeads, createLead, updateLead, deleteLead } from "./leadApi";

dayjs.extend(isSameOrBefore);

const { Option } = Select;

// ✅ status color helper
const statusColor = (status) => {
  switch (status) {
    case "Quoted":
      return "purple";
    case "Converted":
    case "Locked":
      return "success";
    case "Contacted":
      return "gold";
    case "Lost":
      return "red";
    default:
      return "default";
  }
};

export default function Lead() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const navigate = useNavigate();

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await getLeads();
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleSubmit = async (values) => {
    try {
      if (editData?._id) {
        await updateLead(editData._id, values);
        message.success("Lead updated");
      } else {
        await createLead(values);
        message.success("Lead created");
      }
      setOpen(false);
      setEditData(null);
      await fetchLeads();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Action failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteLead(id);
      message.success("Deleted");
      await fetchLeads();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Delete failed");
    }
  };

  const handleStatusChange = async (value, record) => {
    try {
      await updateLead(record._id, { status: value });
      await fetchLeads();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Status update failed");
    }
  };

  // ✅ Lead -> Quote (Correct flow as per PPT/SOW)
  const handleCreateQuote = (leadRecord) => {
    navigate("/admin/quotes/create", {
      state: { lead: leadRecord },
    });
  };

  const columns = [
    { title: "Client Name", dataIndex: "clientName" },
    { title: "Contact", render: (_, r) => `${r.phone || ""}${r.email ? ` | ${r.email}` : ""}` },
    { title: "Job Location", dataIndex: "siteAddress" },
    { title: "Category", dataIndex: "category" },
    { 
      title: "Salesperson", 
      dataIndex: "assignedSalesperson",
      render: (v) => v || "-"
    },
    {
      title: "Next Follow Up",
      dataIndex: "nextFollowUpDate",
      render: (date) => {
        if (!date) return <Tag color="warning">Not set</Tag>;
        const isOverdue = dayjs(date).isSameOrBefore(dayjs(), 'day');
        return <Tag color={isOverdue ? "error" : "success"}>{dayjs(date).format("DD MMM YYYY")}</Tag>;
      }
    },
    {
      title: "Lead Source",
      dataIndex: "leadSource",
      render: (v) => <Tag>{v}</Tag>,
    },

    {
      title: "Status",
      render: (_, record) => {
        const isLocked = record.isLocked || record.status === "Locked" || record.status === "Converted";
        if (isLocked) {
          return <Tag color={statusColor(record.status)}>{record.status}</Tag>;
        }
        return (
          <Space>
            <Tag color={statusColor(record.status)} style={{ minWidth: 90, textAlign: "center" }}>
              {record.status || "New"}
            </Tag>

            <Select
              value={record.status || "New"}
              style={{ width: 140 }}
              onChange={(v) => handleStatusChange(v, record)}
            >
              <Option value="New">New</Option>
              <Option value="Contacted">Contacted</Option>
              <Option value="Quoted">Quoted</Option>
              <Option value="Lost">Lost</Option>
            </Select>
          </Space>
        );
      },
    },

    {
      title: "Actions",
      render: (_, record) => {
        const isLocked = record.isLocked || record.status === "Locked" || record.status === "Converted";
        return (
        <Space wrap>
          <Button 
            onClick={() => navigate(`/admin/lead/${record._id}`)}
          >
            View Details
          </Button>

          {!isLocked && (
            <>
              <Button
                onClick={() => {
                  setEditData(record);
                  setOpen(true);
                }}
              >
                Edit
              </Button>

              <Popconfirm title="Delete lead?" onConfirm={() => handleDelete(record._id)}>
                <Button danger>Delete</Button>
              </Popconfirm>

              <Button type="primary" onClick={() => handleCreateQuote(record)}>
                Create Quote
              </Button>
            </>
          )}
        </Space>
      );
      },
    },
  ];

  return (
    <div>
      <h2>Lead Generation & Qualification</h2>

      <Button
        type="primary"
        style={{ marginBottom: 16 }}
        onClick={() => {
          setEditData(null);
          setOpen(true);
        }}
      >
        + Add Lead
      </Button>

      <div className="table-responsive-wrap">
      <Table
        columns={columns}
        dataSource={leads}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: "max-content" }}
      />
      </div>

      <LeadForm
        open={open}
        onCancel={() => setOpen(false)}
        onSubmit={handleSubmit}
        initialValues={editData}
      />
    </div>
  );
}