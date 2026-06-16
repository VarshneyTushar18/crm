import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Timeline, Button, Modal, Form, DatePicker, InputNumber, Input, message, Switch, Descriptions, Tag, Divider, Row, Col, Space, Table, Tabs } from "antd";
import { DollarOutlined, FileTextOutlined, PlusOutlined, DownloadOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { API_BASE_URL } from '@/config/serverApiConfig';

// Standard Auth Headers
const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const API = `${API_BASE_URL}/job`;

const STAGES_CONFIG = [
  {
    key: "siteMeasurement",
    title: "1. Site Measurement",
    route: "/admin/site-measurement",
    fields: [
      { name: "scheduledDate", label: "Scheduled Date", type: "date" },
      { name: "expectedHours", label: "Expected Hours", type: "number" },
      { name: "actualHours", label: "Actual Hours", type: "number" },
    ]
  },
  {
    key: "planning",
    title: "2. Planning",
    route: "/admin/planning",
    fields: [
      { name: "approvalDate", label: "Approval Date", type: "date" },
      { name: "confirmationRecord", label: "Confirmation Record", type: "text" },
      { name: "attachmentUrl", label: "Attachment URL", type: "text" },
    ]
  },
  {
    key: "drafting",
    title: "3. Drafting",
    route: "/admin/drafting",
    fields: [
      { name: "startExpected", label: "Start Expected", type: "date" },
      { name: "startActual", label: "Start Actual", type: "date" },
      { name: "completionExpected", label: "Completion Expected", type: "date" },
      { name: "completionActual", label: "Completion Actual", type: "date" },
      { name: "documentUrl", label: "Document URL", type: "text" },
    ]
  },
  {
    key: "clientApproval",
    title: "4. Client Approval",
    fields: [
      { name: "approvalDate", label: "Approval Date", type: "date" },
      { name: "confirmationRecord", label: "Confirmation Record", type: "text" },
      { name: "attachmentUrl", label: "Attachment URL", type: "text" },
    ]
  },
  {
    key: "materialPurchasing",
    title: "5. Material Purchasing",
    route: "/admin/material-purchase",
    fields: [
      { name: "requestDate", label: "Request Date", type: "date" },
      { name: "supplierRef", label: "Supplier Ref", type: "text" },
    ]
  },
  {
    key: "fabrication",
    title: "6. Fabrication",
    route: "/admin/fabrication",
    fields: [
      { name: "startExpectedHours", label: "Start Expected Hours", type: "number" },
      { name: "startActualHours", label: "Start Actual Hours", type: "number" },
      { name: "completionExpectedHours", label: "Completion Expected Hours", type: "number" },
      { name: "completionActualHours", label: "Completion Actual Hours", type: "number" },
      { name: "jobCards", label: "Job Cards Info", type: "text" },
    ]
  },
  {
    key: "finishing",
    title: "7. Finishing & QC",
    route: "/admin/qc",
    fields: [
      { name: "startExpected", label: "Start Expected", type: "date" },
      { name: "startActual", label: "Start Actual", type: "date" },
      { name: "completionExpected", label: "Completion Expected", type: "date" },
      { name: "completionActual", label: "Completion Actual", type: "date" },
      { name: "qualityCheckIndicator", label: "QC Indicator", type: "text" },
    ]
  },
  {
    key: "installation",
    title: "8. Installation",
    route: "/admin/installation",
    fields: [
      { name: "scheduledDate", label: "Scheduled Date", type: "date" },
      { name: "expectedHours", label: "Expected Hours", type: "number" },
      { name: "actualHours", label: "Actual Hours", type: "number" },
      { name: "installer", label: "Assigned Installer", type: "text" },
    ]
  },
  {
    key: "jobCompletion",
    title: "9. Job Completion & Sign-Off",
    fields: [
      { name: "completionDate", label: "Completion Date", type: "date" },
      { name: "signatureCapture", label: "Signature (Text/Ref)", type: "text" },
    ]
  }
];

export default function JobView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeStage, setActiveStage] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [form] = Form.useForm();

  const fetchInvoices = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/invoice/listAll?job=${id}`, { headers: authHeaders() });
      if (res.data?.success) setInvoices(res.data.result);
    } catch (err) {
      console.error("Failed to fetch invoices", err);
    }
  };

  const fetchPayments = async () => {
    try {
      // Find invoices first to get their IDs
      const res = await axios.get(`${API_BASE_URL}/payment/listAll`, { headers: authHeaders() });
      if (res.data?.success) {
        // Filter payments that belong to this job's invoices
        const jobInvoicesIds = invoices.map(inv => inv._id);
        const jobPayments = res.data.result.filter(p => jobInvoicesIds.includes(p.invoice?._id || p.invoice));
        setPayments(jobPayments);
      }
    } catch (err) {
      console.error("Failed to fetch payments", err);
    }
  };

  const fetchJob = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/read/${id}`, { headers: authHeaders() });
      if (res.data?.success) setJob(res.data.result);
    } catch (err) {
      message.error("Failed to load job details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchJob();
      fetchInvoices();
    }
  }, [id]);

  useEffect(() => {
    if (invoices.length > 0) {
      fetchPayments();
    }
  }, [invoices]);

  const openStageModal = (stageKey) => {
    setActiveStage(stageKey);
    const existingData = job?.workflowEvents?.[stageKey] || {};

    // Parse dates for DatePicker
    const initialValues = { ...existingData };
    const conf = STAGES_CONFIG.find(s => s.key === stageKey);
    if (conf) {
      conf.fields.forEach(f => {
        if (f.type === "date" && initialValues[f.name]) {
          initialValues[f.name] = dayjs(initialValues[f.name]);
        }
      });
    }

    form.resetFields();
    form.setFieldsValue(initialValues);
    setIsModalOpen(true);
  };

  const handleStageSubmit = async (values) => {
    try {
      // Format dates
      const conf = STAGES_CONFIG.find(s => s.key === activeStage);
      const payload = { ...values };

      if (conf) {
        conf.fields.forEach(f => {
          if (f.type === "date" && payload[f.name]) {
            payload[f.name] = payload[f.name].toISOString();
          }
        });
      }

      await axios.patch(`${API}/stage/${id}/${activeStage}`, payload, { headers: authHeaders() });
      message.success("Stage updated successfully!");
      setIsModalOpen(false);
      fetchJob();
    } catch (err) {
      message.error("Failed to update stage");
    }
  };

  if (loading) return <Card loading={true} />;
  if (!job) return <Card>Job Not Found</Card>;

  const activeStageConfig = STAGES_CONFIG.find(s => s.key === activeStage);

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16}>
        <Col xs={24} md={16}>
          <Card
            title={`Job Timeline: ${job.jobId}`}
            extra={<Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>}
          >
            <Timeline>
              {STAGES_CONFIG.map((stage) => {
                const data = job?.workflowEvents?.[stage.key] || {};
                const isComplete = data?.isCompleted;
                const color = isComplete ? "green" : (Object.keys(data).length > 0 ? "blue" : "gray");
                return (
                  <Timeline.Item key={stage.key} color={color}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0 }}>
                          {stage.title} {isComplete && <Tag color="green" style={{ marginLeft: 8 }}>Completed</Tag>}
                        </h4>
                        {data.completedBy && (
                          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: 'gray' }}>
                            By: {data.completedBy} at {new Date(data.completedAt).toLocaleString()}
                          </p>
                        )}
                        {!isComplete && Object.keys(data).length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <Tag color="orange">In Progress</Tag>
                          </div>
                        )}
                      </div>
                      <Space size="small">
                        {stage.route && (
                          <Button size="small" onClick={() => navigate(`${stage.route}?jobId=${id}`)}>
                            Open External App
                          </Button>
                        )}
                        <Button size="small" type={isComplete ? "default" : "primary"} onClick={() => openStageModal(stage.key)}>
                          {isComplete ? "View Meta" : "Manual Override"}
                        </Button>
                      </Space>
                    </div>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card 
            title={<span><DollarOutlined /> Financial Lifecycle</span>}
            extra={
              <Space>
                <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/admin/invoice/create?job=${id}`)}>
                  Invoice
                </Button>
              </Space>
            }
          >
            <div style={{ marginBottom: 20 }}>
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <Card size="small" style={{ background: '#f5f5f5' }}>
                    <div style={{ fontSize: 12, color: 'gray' }}>Contract Total</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>${(job?.lockedValue || 0).toLocaleString()}</div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" style={{ background: '#e6f7ff' }}>
                    <div style={{ fontSize: 12, color: 'gray' }}>Total Invoiced</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1890ff' }}>${(job?.totalInvoiced || 0).toLocaleString()}</div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" style={{ background: '#f6ffed' }}>
                    <div style={{ fontSize: 12, color: 'gray' }}>Collected</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#52c41a' }}>${(job?.totalPaid || 0).toLocaleString()}</div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" style={{ background: '#fff7e6' }}>
                    <div style={{ fontSize: 12, color: 'gray' }}>Pending</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#fa8c16' }}>${((job?.totalInvoiced || 0) - (job?.totalPaid || 0)).toLocaleString()}</div>
                  </Card>
                </Col>
              </Row>
            </div>

            <Tabs defaultActiveKey="invoices" size="small">
              <Tabs.TabPane tab="Invoices" key="invoices">
                <Table 
                  size="small"
                  pagination={false}
                  dataSource={invoices}
                  rowKey="_id"
                  columns={[
                    { title: 'No.', dataIndex: 'number', key: 'number', render: (text, record) => <a onClick={() => navigate(`/admin/invoice/read/${record._id}`)}>{text}</a> },
                    { title: 'Total', dataIndex: 'total', key: 'total', render: (val) => `$${val?.toLocaleString()}` },
                    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'Paid' ? 'green' : 'blue'} style={{ fontSize: 10 }}>{s}</Tag> },
                  ]}
                />
              </Tabs.TabPane>
              <Tabs.TabPane tab="Payments" key="payments">
                <Table 
                  size="small"
                  pagination={false}
                  dataSource={payments}
                  rowKey="_id"
                  columns={[
                    { title: 'Date', dataIndex: 'date', key: 'date', render: (d) => new Date(d).toLocaleDateString() },
                    { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (val) => `$${val?.toLocaleString()}` },
                    { title: 'Mode', dataIndex: 'paymentMode', key: 'mode', render: (p) => p?.name || 'Cash' },
                  ]}
                />
              </Tabs.TabPane>
            </Tabs>
          </Card>

          <Card title="Job Context" style={{ marginTop: 16 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="System State">
                <Tag color="blue" style={{ fontSize: 14 }}>{job.systemState}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Customer">{job.customer || "-"}</Descriptions.Item>
              <Descriptions.Item label="Site">{job.site || "-"}</Descriptions.Item>
              
              <Descriptions.Item label="Overdue">
                {job.conditions?.isOverdue ? <Tag color="red">Yes</Tag> : <Tag color="green">No</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Defects">
                {job.conditions?.hasDefects ? <Tag color="red">Open</Tag> : "None"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Modal
        title={`Update Stage: ${activeStageConfig?.title}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleStageSubmit}>
          {activeStageConfig?.fields.map(f => (
            <Form.Item key={f.name} name={f.name} label={f.label}>
              {f.type === "date" ? <DatePicker showTime style={{ width: "100%" }} /> :
                f.type === "number" ? <InputNumber style={{ width: "100%" }} /> :
                  <Input />}
            </Form.Item>
          ))}
          <Divider orientation="left">Stage Completion</Divider>
          <Form.Item name="isCompleted" label="Mark as Completed?" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
