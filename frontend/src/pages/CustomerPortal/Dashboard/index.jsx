import { useEffect, useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Statistic,
  Spin,
  Empty,
  List,
  Tag,
  Avatar,
} from "antd";
import {
  ProjectOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';

const { Title, Text } = Typography;

const API_BASE = API_BASE_URL;

const stateColors = {
  New: "blue",
  Active: "processing",
  Completed: "success",
  Closed: "default",
};

const typeColor = (value) => {
  const s = String(value || "").toLowerCase();
  if (s.includes("commercial")) return "purple";
  if (s.includes("residential")) return "green";
  return "default";
};

const getLatestWorkflowStep = (workflowEvents = {}) => {
  const stages = [
    {
      key: "siteMeasurement",
      label: "Site Measurement",
      date:
        workflowEvents?.siteMeasurement?.completedAt ||
        workflowEvents?.siteMeasurement?.scheduledDate,
      done: workflowEvents?.siteMeasurement?.isCompleted,
    },
    {
      key: "drafting",
      label: "Drafting",
      date:
        workflowEvents?.drafting?.completedAt ||
        workflowEvents?.drafting?.startActual ||
        workflowEvents?.drafting?.startExpected,
      done: workflowEvents?.drafting?.isCompleted,
    },
    {
      key: "clientApproval",
      label: "Client Approval",
      date:
        workflowEvents?.clientApproval?.completedAt ||
        workflowEvents?.clientApproval?.approvalDate,
      done: workflowEvents?.clientApproval?.isCompleted,
    },
    {
      key: "materialPurchasing",
      label: "Material Purchasing",
      date:
        workflowEvents?.materialPurchasing?.completedAt ||
        workflowEvents?.materialPurchasing?.requestDate,
      done: workflowEvents?.materialPurchasing?.isCompleted,
    },
    {
      key: "fabrication",
      label: "Fabrication",
      date:
        workflowEvents?.fabrication?.completedAt ||
        workflowEvents?.fabrication?.startActualHours,
      done: workflowEvents?.fabrication?.isCompleted,
    },
    {
      key: "finishing",
      label: "Finishing & QC",
      date:
        workflowEvents?.finishing?.completedAt ||
        workflowEvents?.finishing?.startActual,
      done: workflowEvents?.finishing?.isCompleted,
    },
    {
      key: "installation",
      label: "Installation",
      date:
        workflowEvents?.installation?.completedAt ||
        workflowEvents?.installation?.scheduledDate,
      done: workflowEvents?.installation?.isCompleted,
    },
    {
      key: "jobCompletion",
      label: "Job Completion",
      date:
        workflowEvents?.jobCompletion?.completedAt ||
        workflowEvents?.jobCompletion?.completionDate,
      done: workflowEvents?.jobCompletion?.isCompleted,
    },
  ];

  for (let i = stages.length - 1; i >= 0; i--) {
    const s = stages[i];
    if (s.done || s.date) {
      return s;
    }
  }

  return { label: "Not Started", done: false, date: null };
};

export default function CustomerDashboard() {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const token =
        localStorage.getItem("customer_token") || localStorage.getItem("token");

      if (!token) {
        setLoading(false);
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [meRes, projectsRes] = await Promise.allSettled([
        axios.get(`${API_BASE}/customer/me`, { headers }),
        axios.get(`${API_BASE}/customer/projects`, { headers }),
      ]);

      if (meRes.status === "fulfilled") {
        setCustomer(meRes.value?.data?.result || null);
      }

      if (projectsRes.status === "fulfilled") {
        const result = projectsRes.value?.data?.result;
        setProjects(Array.isArray(result) ? result : []);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Failed to load customer dashboard:", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const total = projects.length;

    const active = projects.filter(
      (item) => String(item?.systemState || "").toLowerCase() === "active"
    ).length;

    const completed = projects.filter(
      (item) => String(item?.systemState || "").toLowerCase() === "completed"
    ).length;

    const onHold = projects.filter(
      (item) => item?.conditions?.onHold === true
    ).length;

    return { total, active, completed, onHold };
  }, [projects]);

  const latestProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => {
        const aDate = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bDate = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 5);
  }, [projects]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Card
        bordered={false}
        style={{
          marginBottom: 16,
          borderRadius: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              Welcome, {customer?.name || customer?.fullName || "Customer"}
            </Title>
            <Text type="secondary">
              View your projects, latest updates, payment details, and contact
              support from your customer portal.
            </Text>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#fafafa",
              border: "1px solid #f0f0f0",
              borderRadius: 12,
              padding: "12px 16px",
              minWidth: 260,
            }}
          >
            <Avatar size={48} icon={<UserOutlined />} />
            <div>
              <div style={{ fontWeight: 600 }}>
                {customer?.name || customer?.fullName || "Customer"}
              </div>
              <Text type="secondary">
                {customer?.email || "Customer Portal"}
              </Text>
            </div>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 16 }}>
            <Statistic
              title="Total Projects"
              value={summary.total}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 16 }}>
            <Statistic
              title="Active Projects"
              value={summary.active}
              prefix={<SyncOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 16 }}>
            <Statistic
              title="Completed"
              value={summary.completed}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 16 }}>
            <Statistic
              title="On Hold"
              value={summary.onHold}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            title="Latest Project Updates"
            bordered={false}
            style={{ borderRadius: 16 }}
          >
            {latestProjects.length === 0 ? (
              <Empty description="No projects found" />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={latestProjects}
                renderItem={(item) => {
                  const latestStep = getLatestWorkflowStep(item?.workflowEvents || {});

                  return (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<ProjectOutlined />} />}
                        title={
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              {item?.jobId || "Project"}
                            </span>
                            <Tag color={typeColor(item?.projectType)}>
                              {item?.projectType || "—"}
                            </Tag>
                            <Tag color={stateColors[item?.systemState] || "default"}>
                              {item?.systemState || "New"}
                            </Tag>
                            <Tag color={latestStep.done ? "success" : "processing"}>
                              {latestStep.label}
                            </Tag>
                          </div>
                        }
                        description={
                          <div style={{ display: "grid", gap: 2 }}>
                            <Text type="secondary">
                              Address: {item?.address || item?.site || "—"}
                            </Text>
                            <Text type="secondary">
                              Latest Timeline Update: {latestStep.label}
                              {latestStep.date
                                ? ` • ${new Date(latestStep.date).toLocaleString()}`
                                : ""}
                            </Text>
                            <Text type="secondary">
                              Last Updated:{" "}
                              {item?.updatedAt || item?.createdAt
                                ? new Date(
                                    item?.updatedAt || item?.createdAt
                                  ).toLocaleString()
                                : "—"}
                            </Text>
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card
            title="Portal Overview"
            bordered={false}
            style={{ borderRadius: 16, marginBottom: 16 }}
          >
            <div style={{ marginBottom: 12 }}>
              <Text strong>What you can do here</Text>
            </div>
            <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
              <li style={{ marginBottom: 8 }}>View only your own projects</li>
              <li style={{ marginBottom: 8 }}>Check project timeline and status</li>
              <li style={{ marginBottom: 8 }}>View payment-related details</li>
              <li style={{ marginBottom: 8 }}>
                Contact support for any query
              </li>
              <li style={{ marginBottom: 8 }}>Manage your profile details</li>
            </ul>
          </Card>

          <Card
            title="Customer Information"
            bordered={false}
            style={{ borderRadius: 16 }}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <Text type="secondary">Name</Text>
                <div style={{ fontWeight: 500 }}>
                  {customer?.name || customer?.fullName || "—"}
                </div>
              </div>

              <div>
                <Text type="secondary">Email</Text>
                <div style={{ fontWeight: 500 }}>
                  {customer?.email || "—"}
                </div>
              </div>

              <div>
                <Text type="secondary">Company</Text>
                <div style={{ fontWeight: 500 }}>
                  {customer?.companyName || "—"}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}