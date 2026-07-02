import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Descriptions, Tag, Timeline, Button, Form, Input, Select, Divider, message, Space, DatePicker, Dropdown } from "antd";
import { DownloadOutlined, DownOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getLead, addLeadInteraction } from "./leadApi";
import { formatLeadAddress, getLeadAddresses } from "./leadAddressUtils";
import { exportLeads, LEAD_EXPORT_FORMATS } from "./leadExportUtils";

const { Option } = Select;

export default function LeadView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  const fetchLead = async () => {
    try {
      setLoading(true);
      const data = await getLead(id);
      setLead(data);
    } catch (err) {
      message.error("Failed to fetch lead details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLead();
  }, [id]);

  const handleAddInteraction = async (values) => {
    try {
      const payload = {
        ...values,
        nextFollowUpDate: values.nextFollowUpDate ? values.nextFollowUpDate.toISOString() : undefined
      };
      await addLeadInteraction(id, payload);
      message.success("Interaction added");
      form.resetFields();
      fetchLead();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Failed to add interaction");
    }
  };

  const leadPhones =
    Array.isArray(lead?.phones) && lead.phones.length
      ? lead.phones.filter((p) => p?.number)
      : lead?.phone
        ? [{ label: "Primary", number: lead.phone, isPrimary: true }]
        : [];

  const leadAddresses = getLeadAddresses(lead);

  const openWhatsApp = (phoneNumber) => {
    if (!phoneNumber) return;
    const onlyDigits = String(phoneNumber).replace(/[^\d+]/g, "");
    const text = encodeURIComponent(
      `Hi ${lead.contactPerson || lead.clientName || ""}, this is regarding your project enquiry.`
    );
    window.open(`https://wa.me/${onlyDigits}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const exportLead = (format = "csv") => {
    if (!lead) return;
    const safeName = String(lead.clientName || "lead").replace(/[^\w\-]+/g, "_");
    exportLeads([lead], format, `lead-${safeName}`, dayjs().format("YYYYMMDD"));
    const formatLabel =
      LEAD_EXPORT_FORMATS.find((item) => item.key === format)?.label || format.toUpperCase();
    message.success(`Lead exported as ${formatLabel}`);
  };

  if (loading) return <div>Loading lead details...</div>;
  if (!lead) return <div>Lead not found</div>;

  const isLocked = lead.isLocked || lead.status === "Locked" || lead.status === "Converted";

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button onClick={() => navigate("/admin/lead")}>{"< Back to Leads"}</Button>
        <Dropdown
          menu={{
            items: LEAD_EXPORT_FORMATS.map((item) => ({
              key: item.key,
              label: item.label,
              onClick: () => exportLead(item.key),
            })),
          }}
        >
          <Button icon={<DownloadOutlined />}>
            Export <DownOutlined />
          </Button>
        </Dropdown>
        {!isLocked && (
          <Button 
            type="primary" 
            onClick={() => navigate("/admin/quotes/create", { state: { lead } })}
          >
            Create Quote
          </Button>
        )}
      </Space>

      <Card title={`Lead: ${lead.clientName || "Unknown"}`} bordered={false}>
        <Descriptions bordered column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
          <Descriptions.Item label="Contact Person">{lead.contactPerson || "-"}</Descriptions.Item>
          <Descriptions.Item label="Phone">{lead.phone || "-"}</Descriptions.Item>
          <Descriptions.Item label="All Numbers" span={2}>
            {leadPhones.length ? (
              <Space wrap>
                {leadPhones.map((p, idx) => (
                  <Tag key={`${p.number}-${idx}`} color={p.isPrimary ? "blue" : "default"}>
                    {p.label || "Other"}: {p.number}
                  </Tag>
                ))}
              </Space>
            ) : (
              "-"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Email">{lead.email || "-"}</Descriptions.Item>
          <Descriptions.Item label="Job Location" span={2}>
            {lead.siteAddress || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="All Addresses" span={2}>
            {leadAddresses.length ? (
              <Space direction="vertical" size={4}>
                {leadAddresses.map((addr, idx) => (
                  <div key={idx}>
                    <Tag color={addr.isPrimary ? "blue" : "default"}>{addr.type || "Site"}</Tag>
                    <span style={{ marginLeft: 8 }}>{formatLeadAddress(addr)}</span>
                  </div>
                ))}
              </Space>
            ) : (
              "-"
            )}
          </Descriptions.Item>
          
          <Descriptions.Item label="Category">{lead.category || "-"}</Descriptions.Item>
          <Descriptions.Item label="Lead Source">{lead.leadSource || "-"}</Descriptions.Item>
          
          <Descriptions.Item label="Status">
            <Tag color={isLocked ? "red" : "blue"}>{lead.status}</Tag>
            {isLocked && <Tag color="error">Locked</Tag>}
          </Descriptions.Item>
          
          <Descriptions.Item label="Next Follow-up">
            {lead.nextFollowUpDate ? dayjs(lead.nextFollowUpDate).format("DD MMM YYYY") : "-"}
          </Descriptions.Item>
          
          <Descriptions.Item label="Assigned Salesperson" span={2}>
            {lead.assignedSalesperson || "-"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Divider />

      {leadPhones.length > 0 && (
        <>
          <Card title="Quick Contact" bordered={false}>
            <Space wrap>
              {leadPhones.map((p, idx) => (
                <Button key={`${p.number}-${idx}`} onClick={() => openWhatsApp(p.number)}>
                  Message {p.label || "Contact"}
                </Button>
              ))}
            </Space>
          </Card>
          <Divider />
        </>
      )}

      <Card title="Interaction History" bordered={false}>
        <Timeline
          mode="left"
          items={(lead.interactions || []).map(i => ({
            label: dayjs(i.date).format("DD MMM YYYY HH:mm"),
            children: (
              <>
                <strong>{i.type}</strong> by {i.createdBy || "System"} <br />
                {i.notes}
              </>
            ),
          }))}
        />
        {(!lead.interactions || lead.interactions.length === 0) && (
          <p>No interactions recorded yet.</p>
        )}
      </Card>

      {!isLocked && (
        <>
          <Divider />
          <Card title="Add Interaction" bordered={false}>
            <Form form={form} layout="vertical" onFinish={handleAddInteraction}>
              <Form.Item name="type" label="Interaction Type" initialValue="Call" rules={[{ required: true }]}>
                <Select>
                  <Option value="Call">Call</Option>
                  <Option value="Email">Email</Option>
                  <Option value="Site Visit">Site Visit</Option>
                  <Option value="Note">Note</Option>
                </Select>
              </Form.Item>
              
              <Form.Item name="notes" label="Notes" rules={[{ required: true, message: "Notes are required" }]}>
                <Input.TextArea rows={3} placeholder="Details of the interaction..." />
              </Form.Item>

              <Form.Item name="status" label="Update Status (Optional)">
                <Select allowClear placeholder="Leave blank to keep current status">
                  <Option value="New">New</Option>
                  <Option value="Contacted">Contacted</Option>
                  <Option value="Quoted">Quoted</Option>
                  <Option value="Lost">Lost</Option>
                </Select>
              </Form.Item>

              <Form.Item name="nextFollowUpDate" label="Next Follow-up Date (Optional)">
                <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
              </Form.Item>

              <Button type="primary" htmlType="submit">Save Interaction</Button>
            </Form>
          </Card>
        </>
      )}
    </div>
  );
}
