import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Descriptions, Tag, Timeline, Button, Form, Input, Select, Divider, message, Space, DatePicker } from "antd";
import dayjs from "dayjs";
import { getLead, addLeadInteraction } from "./leadApi";

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

  if (loading) return <div>Loading lead details...</div>;
  if (!lead) return <div>Lead not found</div>;

  const isLocked = lead.isLocked || lead.status === "Locked" || lead.status === "Converted";

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate("/admin/lead")}>{"< Back to Leads"}</Button>
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
          <Descriptions.Item label="Email">{lead.email || "-"}</Descriptions.Item>
          <Descriptions.Item label="Job Location">{lead.siteAddress || "-"}</Descriptions.Item>
          
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
