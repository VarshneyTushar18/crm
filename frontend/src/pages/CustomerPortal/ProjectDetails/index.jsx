import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Row,
  Col,
  Timeline,
  message,
  Spin,
} from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { customerGetProjectById } from "../customerApi";

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

const getStageStatus = (event = {}) => {
  if (event?.isCompleted) return "Completed";

  const hasStarted = Boolean(
    event?.actualHours ||
      event?.startActual ||
      event?.approvalDate ||
      event?.requestDate ||
      event?.scheduledDate ||
      event?.completionDate ||
      event?.signatureCapture ||
      (Array.isArray(event?.pictures) && event.pictures.length) ||
      (Array.isArray(event?.documents) && event.documents.length)
  );

  if (hasStarted) return "In Progress";
  return "Pending";
};

const getStageColor = (status) => {
  const s = String(status || "").toLowerCase();
  if (s.includes("completed")) return "success";
  if (s.includes("progress")) return "processing";
  return "default";
};

const formatDate = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
};

export default function CustomerProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState(null);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await customerGetProjectById(id);
      setProject(res || null);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to load project details"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const timelineItems = useMemo(() => {
    const wf = project?.workflowEvents || {};

    const stages = [
      {
        key: "siteMeasurement",
        title: "Site Measurement",
        data: wf.siteMeasurement || {},
      },
      {
        key: "drafting",
        title: "Drafting",
        data: wf.drafting || {},
      },
      {
        key: "clientApproval",
        title: "Client Approval",
        data: wf.clientApproval || {},
      },
      {
        key: "materialPurchasing",
        title: "Material Purchasing",
        data: wf.materialPurchasing || {},
      },
      {
        key: "fabrication",
        title: "Fabrication",
        data: wf.fabrication || {},
      },
      {
        key: "finishing",
        title: "Finishing & QC",
        data: wf.finishing || {},
      },
      {
        key: "installation",
        title: "Installation",
        data: wf.installation || {},
      },
      {
        key: "jobCompletion",
        title: "Job Completion & Sign-Off",
        data: wf.jobCompletion || {},
      },
    ];

    return stages.map((stage) => {
      const status = getStageStatus(stage.data);

      const importantDate =
        stage.data?.completedAt ||
        stage.data?.completionDate ||
        stage.data?.startActual ||
        stage.data?.approvalDate ||
        stage.data?.requestDate ||
        stage.data?.scheduledDate ||
        null;

      return {
        color:
          status === "Completed"
            ? "green"
            : status === "In Progress"
            ? "blue"
            : "gray",
        children: (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{stage.title}</div>
            <Tag color={getStageColor(status)}>{status}</Tag>
            {importantDate ? (
              <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
                {formatDate(importantDate)}
              </div>
            ) : null}
          </div>
        ),
      };
    });
  }, [project]);

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <Card>
          <Spin />
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: 16 }}>
        <Card
          title="Project Details"
          extra={<Button onClick={() => navigate("/portal/projects")}>Back</Button>}
        >
          Not found.
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[12, 12]}>
        <Col span={24}>
          <Card
            title={project?.jobId || "Project Details"}
            extra={<Button onClick={() => navigate("/portal/projects")}>Back</Button>}
          >
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Project ID">
                {project?.jobId || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="State">
                <Tag color={stateColor(project?.systemState)}>
                  {project?.systemState || "New"}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Type">
                <Tag color={typeColor(project?.projectType)}>
                  {project?.projectType || "—"}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Customer">
                {project?.customer || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Address" span={2}>
                {project?.address || project?.site || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Quote Value">
                ₹ {Number(project?.lockedValue || 0).toFixed(2)}
              </Descriptions.Item>

              <Descriptions.Item label="Created On">
                {project?.createdAt
                  ? new Date(project.createdAt).toLocaleDateString()
                  : "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Last Updated" span={2}>
                {project?.updatedAt
                  ? new Date(project.updatedAt).toLocaleString()
                  : "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} md={14}>
          <Card title="Project Timeline">
            <Timeline items={timelineItems} />
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Card title="Financial Summary">
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Locked Value">
                ₹ {Number(project?.lockedValue || 0).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Total Invoiced">
                ₹ {Number(project?.totalInvoiced || 0).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Total Paid">
                ₹ {Number(project?.totalPaid || 0).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Balance Due">
                ₹{" "}
                {Number(
                  (project?.totalInvoiced || 0) - (project?.totalPaid || 0)
                ).toFixed(2)}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="System Conditions" style={{ marginTop: 12 }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Overdue">
                {project?.conditions?.isOverdue ? (
                  <Tag color="error">Yes</Tag>
                ) : (
                  <Tag color="success">No</Tag>
                )}
              </Descriptions.Item>

              <Descriptions.Item label="On Hold">
                {project?.conditions?.onHold ? (
                  <Tag color="warning">Yes</Tag>
                ) : (
                  <Tag color="success">No</Tag>
                )}
              </Descriptions.Item>

              <Descriptions.Item label="Has Defects">
                {project?.conditions?.hasDefects ? (
                  <Tag color="error">Yes</Tag>
                ) : (
                  <Tag color="success">No</Tag>
                )}
              </Descriptions.Item>

              <Descriptions.Item label="Hold Reason">
                {project?.conditions?.holdReason || "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
}