import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, List, Row, Tag, Typography, message } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import JobChatPanel from "@/components/JobChatPanel";
import NotificationBell from "@/components/NotificationBell";
import { getWorkerAssignedJobs } from "@/api/extensionApi";

const { Title, Text } = Typography;

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const selectedJobId = searchParams.get("jobId") || "";

  const selectedJob = useMemo(
    () => jobs.find((job) => job._id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  const loadJobs = async () => {
    setLoading(true);
    try {
      const list = await getWorkerAssignedJobs();
      setJobs(Array.isArray(list) ? list : []);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load assigned jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (!selectedJobId && jobs.length === 1) {
      setSearchParams({ jobId: jobs[0]._id });
    }
  }, [jobs, selectedJobId, setSearchParams]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div className="page-shell" style={{ minHeight: "100vh", background: "#f5f7fb", padding: 16 }}>
      <Row justify="space-between" align="middle" gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={12}>
          <BrandLogo variant="header" />
        </Col>
        <Col xs={24} md={12} style={{ textAlign: "right" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <NotificationBell />
            <Button type="primary" danger onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </Col>
      </Row>

      <Title level={3} style={{ marginBottom: 4 }}>
        My Jobs
      </Title>
      <Text type="secondary">Welcome, {user?.name || "Worker"} — chat with admin and site engineer on your assigned projects.</Text>

      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={9}>
          <Card title="Assigned Jobs" loading={loading}>
            {jobs.length === 0 ? (
              <Text type="secondary">No schedule assignments found for your account yet.</Text>
            ) : (
              <List
                dataSource={jobs}
                renderItem={(job) => {
                  const nextAssignment = job.assignments?.[0];
                  const isActive = job._id === selectedJobId;
                  return (
                    <List.Item
                      style={{
                        cursor: "pointer",
                        borderRadius: 8,
                        padding: "10px 12px",
                        marginBottom: 8,
                        background: isActive ? "#e6f4ff" : "#fafafa",
                        border: isActive ? "1px solid #91caff" : "1px solid #f0f0f0",
                      }}
                      onClick={() => setSearchParams({ jobId: job._id })}
                    >
                      <div style={{ width: "100%" }}>
                        <div style={{ fontWeight: 600 }}>{job.jobId}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>{job.customer || "—"}</div>
                        {nextAssignment ? (
                          <div style={{ marginTop: 6 }}>
                            <Tag color="blue">{nextAssignment.assignmentType}</Tag>
                            <Tag>{nextAssignment.status}</Tag>
                            {Array.isArray(nextAssignment.teams) && nextAssignment.teams.length ? (
                              <div style={{ marginTop: 4 }}>
                                {nextAssignment.teams.map((team) => (
                                  <Tag key={team}>{team}</Tag>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card title={selectedJob ? `Team Chat — ${selectedJob.jobId}` : "Team Chat"}>
            {selectedJob ? (
              <>
                <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
                  {selectedJob.site || "No site address"} · {selectedJob.systemState || "Active"}
                </Text>
                <JobChatPanel jobId={selectedJob._id} jobLabel={selectedJob.jobId} />
              </>
            ) : (
              <Text type="secondary">Select a job from the left to open the team chat thread.</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
