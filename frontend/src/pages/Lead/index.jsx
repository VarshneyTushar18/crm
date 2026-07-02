import { useEffect, useMemo, useState } from "react";
import { Button, Table, Space, Popconfirm, Select, Tag, message, DatePicker, Dropdown } from "antd";
import { DownloadOutlined, DownOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import LeadForm from "./LeadForm";
import { getLeads, createLead, updateLead, deleteLead } from "./leadApi";
import { getLeadSiteAddress } from "./leadAddressUtils";
import {
  exportLeads,
  filterLeadsByDateRange,
  getLeadPhonesList,
  LEAD_EXPORT_FORMATS,
  buildLeadRangeLabel,
} from "./leadExportUtils";

const { RangePicker } = DatePicker;

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
  const [dateRange, setDateRange] = useState(null);
  const [dateField, setDateField] = useState("createdAt");

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

  const getLeadPhones = (record) => getLeadPhonesList(record);

  const filteredLeads = useMemo(
    () => filterLeadsByDateRange(leads, dateRange, dateField),
    [leads, dateRange, dateField]
  );

  const handleExportLeads = (format = "csv") => {
    if (!filteredLeads.length) {
      message.warning("No leads found in selected date range");
      return;
    }

    const rangeLabel = buildLeadRangeLabel(dateRange);
    exportLeads(filteredLeads, format, "leads", rangeLabel);

    const formatLabel =
      LEAD_EXPORT_FORMATS.find((item) => item.key === format)?.label || format.toUpperCase();
    message.success(`Exported ${filteredLeads.length} lead(s) as ${formatLabel}`);
  };

  const openWhatsApp = (record) => {
    const phones = getLeadPhones(record);
    const target = phones.find((p) => p.isPrimary) || phones[0];
    if (!target?.number) {
      message.warning("No phone number found for this lead");
      return;
    }
    const onlyDigits = String(target.number).replace(/[^\d+]/g, "");
    const text = encodeURIComponent(
      `Hi ${record.contactPerson || record.clientName || ""}, this is regarding your project enquiry.`
    );
    window.open(`https://wa.me/${onlyDigits}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  // ✅ Lead -> Quote (Correct flow as per PPT/SOW)
  const handleCreateQuote = (leadRecord) => {
    navigate("/admin/quotes/create", {
      state: { lead: leadRecord },
    });
  };

  const columns = [
    { title: "Client Name", dataIndex: "clientName" },
    {
      title: "Contact",
      render: (_, r) => {
        const phones = getLeadPhones(r);
        const primary = phones.find((p) => p.isPrimary) || phones[0];
        const more = Math.max(0, phones.length - 1);
        return `${primary?.number || r.phone || ""}${more ? ` (+${more})` : ""}${r.email ? ` | ${r.email}` : ""}`;
      },
    },
    { title: "Job Location", render: (_, r) => getLeadSiteAddress(r) || "-" },
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

              <Button onClick={() => openWhatsApp(record)}>Message</Button>

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

      <Space style={{ marginBottom: 16 }} wrap align="center">
        <Button
          type="primary"
          onClick={() => {
            setEditData(null);
            setOpen(true);
          }}
        >
          + Add Lead
        </Button>

        <Select
          value={dateField}
          onChange={setDateField}
          style={{ width: 160 }}
          options={[
            { value: "createdAt", label: "Created Date" },
            { value: "nextFollowUpDate", label: "Follow-up Date" },
          ]}
        />

        <RangePicker
          value={dateRange}
          onChange={(values) => setDateRange(values)}
          format="DD MMM YYYY"
          allowClear
          placeholder={["From date", "To date"]}
        />

        <Dropdown
          disabled={!filteredLeads.length}
          menu={{
            items: LEAD_EXPORT_FORMATS.map((item) => ({
              key: item.key,
              label: item.label,
              onClick: () => handleExportLeads(item.key),
            })),
          }}
        >
          <Button icon={<DownloadOutlined />} disabled={!filteredLeads.length}>
            Export <DownOutlined />
          </Button>
        </Dropdown>

        {dateRange?.[0] && dateRange?.[1] ? (
          <Tag color="blue">
            Showing {filteredLeads.length} of {leads.length}
          </Tag>
        ) : null}
      </Space>

      <div className="table-responsive-wrap">
      <Table
        columns={columns}
        dataSource={filteredLeads}
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