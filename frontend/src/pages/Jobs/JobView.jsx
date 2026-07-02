import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Timeline, Button, Modal, Form, DatePicker, InputNumber, Input, message, Switch, Descriptions, Tag, Divider, Row, Col, Space, Table, Tabs, Progress } from "antd";
import { DollarOutlined, FileTextOutlined, PlusOutlined, DownloadOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { API_BASE_URL } from '@/config/serverApiConfig';
import { buildStagesConfig, MODULES_REQUIRING_SITE_ENGINEER, calcStageCompletionPercent } from "@/config/workflowConfig";
import { STAGE_MANUAL_FIELDS, getStageManualFieldRules } from "@/config/stageManualFields";
import { getSiteEngineerReviews } from "@/api/extensionApi";
import JobChatPanel from "@/components/JobChatPanel";

// Standard Auth Headers
const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const API = `${API_BASE_URL}/job`;

const LEGACY_STAGES_CONFIG = [
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

function getStagesConfigForJob(job) {
  if (!job) return LEGACY_STAGES_CONFIG;
  return buildStagesConfig(job).map((stage) => ({
    ...stage,
    fields: STAGE_MANUAL_FIELDS[stage.key] || [],
  }));
}

export default function JobView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeStage, setActiveStage] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [seReviews, setSeReviews] = useState([]);
  const [form] = Form.useForm();

  const stagesConfig = useMemo(() => getStagesConfigForJob(job), [job]);

  const moduleReviewMap = useMemo(() => {
    const map = {};
    (seReviews || []).forEach((review) => {
      if (review.moduleStageKey) {
        map[review.moduleStageKey] = review;
      }
    });
    return map;
  }, [seReviews]);

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
      if (res.data?.success) {
        const data = res.data.result;
        setJob(data);
      }
      try {
        const reviews = await getSiteEngineerReviews(id);
        setSeReviews(Array.isArray(reviews) ? reviews : []);
      } catch {
        setSeReviews([]);
      }
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
    const conf = stagesConfig.find(s => s.key === stageKey);
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
      const conf = stagesConfig.find(s => s.key === activeStage);
      const payload = { ...values };

      if (values.isCompleted && conf?.fields?.length) {
        const missing = conf.fields.filter(
          (field) => {
            const val = values[field.name];
            if (field.type === "number") {
              return val === null || val === undefined || val === "" || Number(val) <= 0;
            }
            if (field.type === "date") {
              return !val;
            }
            return !String(val ?? "").trim();
          }
        );
        if (missing.length) {
          message.warning(
            `Fill all required fields before closing: ${missing.map((f) => f.label).join(", ")}`
          );
          return;
        }
      }

      if (conf) {
        conf.fields.forEach(f => {
          if (f.type === "date" && payload[f.name]) {
            payload[f.name] = payload[f.name].toISOString();
          }
        });
      }

      const res = await axios.patch(`${API}/stage/${id}/${activeStage}`, payload, { headers: authHeaders() });
      message.success(res.data?.message || "Stage updated successfully!");
      setIsModalOpen(false);
      fetchJob();
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to update stage");
    }
  };

  if (loading) return <Card loading={true} />;
  if (!job) return <Card>Job Not Found</Card>;

  const activeStageConfig = stagesConfig.find(s => s.key === activeStage);

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16}>
        <Col xs={24} md={16}>
          <Card
            title={`Job Timeline: ${job.jobId}`}
            extra={<Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>}
          >
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 4 }}>Overall completion</div>
              <Progress percent={job.autoCompletionPercent ?? job.completionPercent ?? 0} status="active" />
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                Calculated from completed workflow stages ({stagesConfig.length} stages)
              </div>
            </div>
            <Timeline>
              {stagesConfig.map((stage) => {
                const data = job?.workflowEvents?.[stage.key] || {};
                const moduleReview = moduleReviewMap[stage.key];
                const reviewStatus = moduleReview?.status;
                const seStatus =
                  data?.siteEngineerStatus ||
                  (reviewStatus === "Approved"
                    ? "Approved"
                    : reviewStatus === "Rejected"
                      ? "Rejected"
                      : reviewStatus === "Pending"
                        ? "Pending"
                        : null);
                const needsSiteEngineer = MODULES_REQUIRING_SITE_ENGINEER.includes(stage.key);
                const awaitingSE =
                  seStatus === "Pending" ||
                  data?.stageStatus === "Awaiting Site Engineer";
                const rejectedBySE = seStatus === "Rejected";
                const acceptedBySE = seStatus === "Approved";
                const isComplete = needsSiteEngineer
                  ? (acceptedBySE && !!data?.isCompleted) ||
                    (!seStatus && !!data?.isCompleted)
                  : !!(data?.isCompleted || data?.stageStatus === "Complete");
                const stageStatus =
                  rejectedBySE
                    ? "Rejected by Site Engineer"
                    : awaitingSE
                      ? "Awaiting Site Engineer"
                      : data?.stageStatus || (isComplete ? "Complete" : "Pending");
                const color = isComplete
                  ? "green"
                  : rejectedBySE
                    ? "red"
                    : awaitingSE
                      ? "orange"
                      : stageStatus === "In Progress"
                        ? "blue"
                        : "gray";
                const submittedBy = data?.moduleWorkComplete ? data?.completedBy : null;
                const checkedBy =
                  data?.siteEngineerCheckedBy || moduleReview?.reviewedBy || null;
                const checkedAt = data?.siteEngineerCheckedAt || moduleReview?.reviewedAt;
                const rejectComments = rejectedBySE
                  ? moduleReview?.comments || data?.siteEngineerComments
                  : null;
                const stagePercent = calcStageCompletionPercent(data);
                return (
                  <Timeline.Item key={stage.key} color={color}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0 }}>
                          {stage.title}{" "}
                          <Tag color={stagePercent >= 100 ? "green" : stagePercent > 0 ? "blue" : "default"}>
                            {stagePercent}%
                          </Tag>
                          {!needsSiteEngineer && (
                            <Tag color={isComplete ? "green" : "default"}>
                              {isComplete ? "Completed" : stageStatus}
                            </Tag>
                          )}
                          {needsSiteEngineer && !seStatus && !data?.moduleWorkComplete && (
                            <Tag>Pending</Tag>
                          )}
                          {needsSiteEngineer && awaitingSE && (
                            <Tag color="orange">Pending Site Engineer Review</Tag>
                          )}
                          {needsSiteEngineer && acceptedBySE && (
                            <Tag color="green">Accepted by Site Engineer</Tag>
                          )}
                          {needsSiteEngineer && rejectedBySE && (
                            <Tag color="red">Rejected by Site Engineer</Tag>
                          )}
                        </h4>
                        <Progress
                          percent={stagePercent}
                          size="small"
                          style={{ maxWidth: 320, marginTop: 6, marginBottom: 4 }}
                          status={stagePercent >= 100 ? "success" : stagePercent > 0 ? "active" : "normal"}
                        />
                        {submittedBy && awaitingSE && (
                          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: 'gray' }}>
                            Submitted by: {submittedBy}
                            {data?.completedAt
                              ? ` at ${new Date(data.completedAt).toLocaleString()}`
                              : ""}
                          </p>
                        )}
                        {acceptedBySE && checkedBy && (
                          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: '#389e0d' }}>
                            Accepted by: {checkedBy}
                            {checkedAt ? ` at ${new Date(checkedAt).toLocaleString()}` : ""}
                          </p>
                        )}
                        {rejectedBySE && checkedBy && (
                          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: '#cf1322' }}>
                            Rejected by: {checkedBy}
                            {checkedAt ? ` at ${new Date(checkedAt).toLocaleString()}` : ""}
                          </p>
                        )}
                        {rejectedBySE && rejectComments && (
                          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: '#cf1322' }}>
                            Reason: {rejectComments}
                          </p>
                        )}
                        {stage.key === "siteEngineerApproval" && seReviews.length > 0 && (
                          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: 'gray' }}>
                            Reviews — Accepted:{" "}
                            {seReviews.filter((r) => r.status === "Approved").length},{" "}
                            Rejected: {seReviews.filter((r) => r.status === "Rejected").length},{" "}
                            Pending:{" "}
                            {seReviews.filter((r) =>
                              ["Pending", "Revision Required"].includes(r.status)
                            ).length}
                          </p>
                        )}
                        {!isComplete &&
                          stageStatus === "In Progress" &&
                          !awaitingSE &&
                          !rejectedBySE &&
                          !needsSiteEngineer && (
                          <div style={{ marginTop: 4 }}>
                            <Tag color="blue">In Progress</Tag>
                          </div>
                        )}
                        {!isComplete &&
                          !awaitingSE &&
                          !rejectedBySE &&
                          needsSiteEngineer &&
                          !acceptedBySE &&
                          data?.stageStatus === "In Progress" && (
                          <div style={{ marginTop: 4 }}>
                            <Tag color="blue">In Progress</Tag>
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
              <Tabs.TabPane tab="Team Chat" key="comments">
                <JobChatPanel jobId={job?._id} jobLabel={job?.jobId} />
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
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.isCompleted !== cur.isCompleted}>
            {({ getFieldValue }) => {
              const isCompleting = !!getFieldValue("isCompleted");
              return activeStageConfig?.fields.map((f) => (
                <Form.Item
                  key={f.name}
                  name={f.name}
                  label={f.label}
                  rules={getStageManualFieldRules(f, isCompleting)}
                >
                  {f.type === "date" ? (
                    <DatePicker showTime style={{ width: "100%" }} />
                  ) : f.type === "number" ? (
                    <InputNumber min={0.01} style={{ width: "100%" }} />
                  ) : (
                    <Input />
                  )}
                </Form.Item>
              ));
            }}
          </Form.Item>
          <Divider orientation="left">Stage Completion</Divider>
          <Form.Item
            name="isCompleted"
            label="Mark as Completed?"
            valuePropName="checked"
            extra="All fields above are required when marking a stage complete."
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
