import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tabs,
  message,
} from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { buildFileUrl } from "@/config/serverApiConfig";
import { STAGE_LABELS } from "@/config/workflowConfig";
import { useJob } from "../../context/JobContext";
import { getJobs } from "../Jobs/jobApi";
import { getDraftingRecords } from "../Drafting/draftingApi";
import {
  approveSiteEngineerReview,
  ensureSiteEngineerReview,
  getSiteEngineerAllReviews,
  getSiteEngineerReviews,
  getSiteEngineerSummary,
  rejectSiteEngineerReview,
  updateSiteEngineerReviewStatus,
} from "../../api/extensionApi";
import JobChatPanel from "@/components/JobChatPanel";

const { Option } = Select;
const { TextArea } = Input;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Pending Review", label: "Pending Review" },
  { value: "On Review", label: "On Review" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "On Hold", label: "On Hold" },
];

const ACTIONABLE_STATUSES = new Set([
  "Pending",
  "Pending Review",
  "On Review",
]);

const normalizeStatus = (status) =>
  status === "Pending" ? "Pending Review" : status || "Pending Review";

export default function SiteEngineer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeJobId } = useJob();
  const userRole = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")?.role || "";
    } catch {
      return "";
    }
  })();

  const [jobs, setJobs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [allReviews, setAllReviews] = useState([]);
  const [draftings, setDraftings] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [comments, setComments] = useState("");
  const [summary, setSummary] = useState(null);

  const queryJobId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("jobId");
  }, [location.search]);

  const jobId = queryJobId || activeJobId || localStorage.getItem("activeJobId");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [jobList, reviewList, summaryData] = await Promise.all([
        getJobs(),
        getSiteEngineerAllReviews(
          statusFilter === "all" ? {} : { status: statusFilter }
        ),
        getSiteEngineerSummary(),
      ]);
      setJobs(Array.isArray(jobList) ? jobList : []);
      setAllReviews(Array.isArray(reviewList) ? reviewList : []);
      setSummary(summaryData);

      if (jobId) {
        const currentJob = (Array.isArray(jobList) ? jobList : []).find((j) => j._id === jobId);
        setSelectedJob(currentJob || null);
        const [revs, drafts] = await Promise.all([
          getSiteEngineerReviews(jobId),
          getDraftingRecords(jobId),
        ]);
        setReviews(Array.isArray(revs) ? revs : []);
        setDraftings(Array.isArray(drafts) ? drafts : []);
      } else {
        setSelectedJob(null);
        setReviews([]);
        setDraftings([]);
      }
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [jobId, statusFilter]);

  const queueDrawing = async (draftingId) => {
    try {
      await ensureSiteEngineerReview(draftingId);
      message.success("Drawing queued for site engineer review");
      await fetchAll();
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to queue drawing");
    }
  };

  const approve = async (reviewId) => {
    try {
      await approveSiteEngineerReview(reviewId, "");
      message.success("Drawing approved");
      await fetchAll();
    } catch (err) {
      message.error(err?.response?.data?.message || "Approve failed");
    }
  };

  const openReject = (review) => {
    setSelectedReview(review);
    setComments("");
    setRejectOpen(true);
  };

  const submitReject = async () => {
    if (!comments.trim()) {
      message.warning("Comments are required");
      return;
    }
    try {
      await rejectSiteEngineerReview(selectedReview._id, comments);
      message.success("Drawing rejected");
      setRejectOpen(false);
      await fetchAll();
    } catch (err) {
      message.error(err?.response?.data?.message || "Reject failed");
    }
  };

  const planningComplete = Boolean(selectedJob?.workflowEvents?.planning?.isCompleted);

  const getDrawingFileUrl = (record) =>
    record?.fileUrl || record?.draftingId?.fileUrl || record?.attachmentUrl || "";

  const viewDrawing = (record) => {
    const url = buildFileUrl(getDrawingFileUrl(record));
    if (!url) {
      message.warning("No drawing file uploaded yet");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const emptyGuidance = !jobId
    ? "Select a job to review drawings."
    : !planningComplete
      ? "Complete Planning for this job first, then add drafting drawings."
      : draftings.length === 0
        ? "No drafting drawings yet. Go to Drafting → Add Draft — approvals will appear here automatically."
        : reviews.length === 0
          ? "Drawings exist but are not queued yet. Click Queue Review or re-save the drafting record."
          : "";

  const reviewLabel = (r) => {
    if (r.reviewType === "module" || r.moduleStageKey) {
      return r.title || STAGE_LABELS[r.moduleStageKey] || r.moduleStageKey || "Module";
    }
    return r.drawingRef || r.draftingId?.drawingRef || r.draftingId?.title || "-";
  };

  const changeReviewStatus = async (reviewId, status) => {
    try {
      await updateSiteEngineerReviewStatus(reviewId, status);
      message.success(`Status updated to ${status}`);
      await fetchAll();
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to update status");
    }
  };

  const filteredJobReviews = useMemo(() => {
    if (statusFilter === "all") return reviews;
    return reviews.filter((r) => {
      const s = normalizeStatus(r.status);
      if (statusFilter === "Pending Review") {
        return s === "Pending Review";
      }
      return s === statusFilter;
    });
  }, [reviews, statusFilter]);

  const openQueueCount = useMemo(
    () =>
      allReviews.filter((r) => ACTIONABLE_STATUSES.has(r.status)).length,
    [allReviews]
  );

  const isSiteEngineerUser = userRole === "siteEngineer";

  const statusTag = (status) => {
    const normalized = normalizeStatus(status);
    const color =
      normalized === "Approved"
        ? "success"
        : normalized === "Rejected"
        ? "error"
        : normalized === "On Hold"
        ? "warning"
        : normalized === "On Review"
        ? "processing"
        : "default";
    return <Tag color={color}>{normalized}</Tag>;
  };

  const adminProgressColumns = [
    {
      title: "Job",
      render: (_, r) => r.jobId?.jobId || r.jobId || "-",
    },
    {
      title: "Type",
      render: (_, r) =>
        r.reviewType === "module" || r.moduleStageKey ? (
          <Tag color="purple">Module</Tag>
        ) : (
          <Tag>Drawing</Tag>
        ),
    },
    {
      title: "Item",
      render: (_, r) => reviewLabel(r),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s) => statusTag(s),
    },
    { title: "Reviewed By", dataIndex: "reviewedBy", render: (v) => v || "-" },
    {
      title: "Updated",
      dataIndex: "updatedAt",
      render: (v) => (v ? new Date(v).toLocaleString() : "-"),
    },
  ];

  const reviewColumns = [
    {
      title: "Type",
      render: (_, r) =>
        r.reviewType === "module" || r.moduleStageKey ? (
          <Tag color="purple">Module</Tag>
        ) : (
          <Tag>Drawing</Tag>
        ),
    },
    {
      title: "Item",
      render: (_, r) => reviewLabel(r),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s, record) => (
        <Select
          size="small"
          style={{ minWidth: 150 }}
          value={normalizeStatus(s)}
          onChange={(value) => changeReviewStatus(record._id, value)}
          options={STATUS_OPTIONS.filter((o) => o.value !== "all")}
        />
      ),
    },
    { title: "Reviewed By", dataIndex: "reviewedBy", render: (v) => v || "-" },
    {
      title: "Actions",
      render: (_, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            disabled={!getDrawingFileUrl(record)}
            onClick={() => viewDrawing(record)}
          >
            View
          </Button>
          {ACTIONABLE_STATUSES.has(record.status) ? (
            <>
              <Button size="small" type="primary" onClick={() => approve(record._id)}>
                Approve
              </Button>
              <Button size="small" danger onClick={() => openReject(record)}>
                Reject
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-shell">
      <div className="page-shell__header">
        <div>
          <h2 className="page-shell__title">
            {isSiteEngineerUser ? "Site Engineer Approval" : "SE Approval Progress"}
          </h2>
          <div style={{ color: "#666" }}>
            {isSiteEngineerUser
              ? "Quality-control checkpoint before jobs move to the next stage."
              : "Track site engineer approval status across jobs. Approvals are actioned by the site engineer only."}
          </div>
        </div>
        <Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>
      </div>

      {isSiteEngineerUser ? (
        <Card style={{ marginBottom: 16 }} size="small" title="Site Engineer Modules">
          <Space wrap>
            <Button onClick={() => navigate("/admin/scheduling")}>Scheduling</Button>
            <Button onClick={() => navigate("/admin/jobs")}>Assigned Jobs</Button>
            <Button onClick={() => navigate("/admin/fabrication")}>Fabrication</Button>
            <Button onClick={() => navigate("/admin/qc")}>Quality Check</Button>
            <Button onClick={() => navigate("/admin/installation")}>Installation</Button>
          </Space>
        </Card>
      ) : null}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Open reviews" value={summary?.openCount ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="Pending review"
              value={summary?.counts?.["Pending Review"] ?? 0}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="On review"
              value={summary?.counts?.["On Review"] ?? 0}
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="Rejected"
              value={summary?.counts?.Rejected ?? 0}
              valueStyle={{ color: "#cf1322" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Approved" value={summary?.counts?.Approved ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Total reviews" value={summary?.total ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Filter by Job</div>
            <Select
              showSearch
              allowClear
              style={{ width: "100%" }}
              placeholder="Select job"
              value={jobId || undefined}
              onChange={(v) =>
                navigate(v ? `/admin/site-engineer?jobId=${v}` : "/admin/site-engineer")
              }
              optionFilterProp="children"
            >
              {jobs.map((job) => (
                <Option key={job._id} value={job._id}>
                  {job.jobId} - {job.customer || "No customer"}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Filter by Status</div>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
            />
          </Col>
        </Row>
      </Card>

      {isSiteEngineerUser ? (
        <Tabs
          items={[
            {
              key: "job",
              label: "Job Drawings",
              children: jobId ? (
              <>
                <Card size="small" title="Drafting Records" style={{ marginBottom: 16 }}>
                  {draftings.length === 0 ? (
                    <Empty
                      description={emptyGuidance}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                      {planningComplete ? (
                        <Button
                          type="primary"
                          onClick={() => navigate(`/admin/drafting?jobId=${jobId}`)}
                        >
                          Go to Drafting
                        </Button>
                      ) : (
                        <Button onClick={() => navigate(`/admin/planning?jobId=${jobId}`)}>
                          Go to Planning
                        </Button>
                      )}
                    </Empty>
                  ) : (
                    <Table
                      rowKey="_id"
                      size="small"
                      pagination={false}
                      dataSource={draftings}
                      columns={[
                        { title: "Title", dataIndex: "title" },
                        { title: "Revision", dataIndex: "revision" },
                        { title: "Status", dataIndex: "status" },
                        {
                          title: "Actions",
                          render: (_, d) => (
                            <Space wrap>
                              <Button
                                size="small"
                                icon={<EyeOutlined />}
                                disabled={!getDrawingFileUrl(d)}
                                onClick={() => viewDrawing(d)}
                              >
                                View
                              </Button>
                              <Button size="small" onClick={() => queueDrawing(d._id)}>
                                Queue Review
                              </Button>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  )}
                </Card>
                {reviews.length === 0 && draftings.length > 0 ? (
                  <Empty
                    style={{ marginBottom: 16 }}
                    description="Queued reviews will appear below after drafting is saved."
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : null}
                <Table
                  rowKey="_id"
                  loading={loading}
                  columns={reviewColumns}
                  dataSource={filteredJobReviews}
                  pagination={{ pageSize: 10 }}
                />
              </>
            ) : (
              <Empty description="Select a job to review drawings" />
            ),
          },
          {
            key: "pending",
            label: `Review Queue (${openQueueCount})`,
            children: (
              <Table
                rowKey="_id"
                loading={loading}
                dataSource={allReviews}
                columns={[
                  {
                    title: "Job",
                    render: (_, r) => r.jobId?.jobId || r.jobId || "-",
                  },
                  {
                    title: "Type",
                    render: (_, r) =>
                      r.reviewType === "module" || r.moduleStageKey ? (
                        <Tag color="purple">Module</Tag>
                      ) : (
                        <Tag>Drawing</Tag>
                      ),
                  },
                  {
                    title: "Item",
                    render: (_, r) => reviewLabel(r),
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    render: (s, record) => (
                      <Select
                        size="small"
                        style={{ minWidth: 150 }}
                        value={normalizeStatus(s)}
                        onChange={(value) => changeReviewStatus(record._id, value)}
                        options={STATUS_OPTIONS.filter((o) => o.value !== "all")}
                      />
                    ),
                  },
                  {
                    title: "Actions",
                    render: (_, record) => (
                      <Space wrap>
                        <Button
                          size="small"
                          icon={<EyeOutlined />}
                          disabled={!getDrawingFileUrl(record)}
                          onClick={() => viewDrawing(record)}
                        >
                          View
                        </Button>
                        {ACTIONABLE_STATUSES.has(record.status) ? (
                          <>
                            <Button size="small" type="primary" onClick={() => approve(record._id)}>
                              Approve
                            </Button>
                            <Button size="small" danger onClick={() => openReject(record)}>
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: "chat",
            label: "Team Chat",
            children: jobId ? (
              <Card size="small">
                <JobChatPanel
                  jobId={jobId}
                  jobLabel={selectedJob?.jobId || jobId}
                />
              </Card>
            ) : (
              <Empty description="Select a job to use team chat" />
            ),
          },
        ]}
      />
      ) : (
        <Card title={`Approval Queue (${openQueueCount} open)`}>
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={allReviews}
            columns={adminProgressColumns}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      {isSiteEngineerUser ? (
        <Modal
          title="Reject Drawing"
          open={rejectOpen}
          onCancel={() => setRejectOpen(false)}
          onOk={submitReject}
          okText="Reject"
          okButtonProps={{ danger: true }}
        >
          <TextArea
            rows={4}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Explain what needs to be revised..."
          />
        </Modal>
      ) : null}
    </div>
  );
}
