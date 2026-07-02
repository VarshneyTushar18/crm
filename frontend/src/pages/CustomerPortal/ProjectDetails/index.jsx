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
  Progress,
  Spin,
} from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { customerGetProjectById } from "../customerApi";
import { STAGE_LABELS, getTimelineStageKeys, calcStageCompletionPercent } from "@/config/workflowConfig";

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
    if (Array.isArray(project?.timeline) && project.timeline.length > 0) {
      return project.timeline.map((stage) => {
        const status =
          stage.isCompleted || stage.stageStatus === "Complete"
            ? "Completed"
            : stage.stageStatus || "Pending";
        const stagePercent =
          stage.completionPercent ??
          calcStageCompletionPercent({
            isCompleted: stage.isCompleted,
            stageStatus: stage.stageStatus,
          });

        return {
          color:
            status === "Completed"
              ? "green"
              : status === "In Progress"
              ? "blue"
              : "gray",
          children: (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {stage.order ? `${stage.order}. ` : ""}
                {stage.title}{" "}
                <Tag color={stagePercent >= 100 ? "success" : stagePercent > 0 ? "processing" : "default"}>
                  {stagePercent}%
                </Tag>
              </div>
              <Progress
                percent={stagePercent}
                size="small"
                style={{ maxWidth: 280, marginBottom: 8 }}
              />
              <Tag color={getStageColor(status)}>{status}</Tag>
              {stage.completedAt ? (
                <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
                  {formatDate(stage.completedAt)}
                </div>
              ) : null}
            </div>
          ),
        };
      });
    }

    const wf = project?.workflowEvents || {};
    const keys = getTimelineStageKeys(project?.workflowVersion || 2);

    const stages = keys.map((key) => ({
      key,
      title: STAGE_LABELS[key] || key,
      data: wf[key] || {},
    }));

    return stages.map((stage) => {
      const status = getStageStatus(stage.data);
      const stagePercent = calcStageCompletionPercent(stage.data);

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
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              {stage.title}{" "}
              <Tag color={stagePercent >= 100 ? "success" : stagePercent > 0 ? "processing" : "default"}>
                {stagePercent}%
              </Tag>
            </div>
            <Progress
              percent={stagePercent}
              size="small"
              style={{ maxWidth: 280, marginBottom: 8 }}
            />
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
      <div style={{ padding: 16, textAlign: "center" }}>
        <Card>
          <Spin size="large" />
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
              <Descriptions.Item label="Overall Progress" span={2}>
                <Progress percent={project?.completionPercent || 0} size="small" />
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                  Based on completed workflow stages
                </div>
              </Descriptions.Item>
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
          {project?.quote ? (
            <Card
              title="Project Quote"
              extra={
                <Button
                  type="link"
                  onClick={() => navigate(`/portal/quotes/${project.quote._id}`)}
                >
                  View Full Quote
                </Button>
              }
            >
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Quote #">
                  {project.quote.quoteNumber || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={project.quote.status === "Accepted" ? "success" : "processing"}>
                    {project.quote.status || "—"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Amount">
                  ₹ {Number(project.quote.totalAmount || 0).toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="Valid Until">
                  {project.quote.validUntil
                    ? new Date(project.quote.validUntil).toLocaleDateString()
                    : "—"}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          ) : null}

          <Card title="Financial Summary" style={{ marginTop: project?.quote ? 12 : 0 }}>
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
              <Descriptions.Item label="Outstanding Balance">
                ₹ {Number(project?.outstandingBalance ?? ((project?.totalInvoiced || 0) - (project?.totalPaid || 0))).toFixed(2)}
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