import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  List,
  Row,
  Tag,
  Typography,
  message,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  Checkbox,
  Space,
  Divider,
  Tabs,
} from "antd";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import JobChatPanel from "@/components/JobChatPanel";
import { getMyJobCards, executeJobCard } from "@/pages/Installation/jobCardApi";
import { getMyProductivitySummary } from "@/pages/Productivity/productivityApi";
import { useWorkerJobs } from "@/pages/Worker/useWorkerJobs";
import { buildMapsLink } from "@/pages/Worker/workerUtils";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const STATUS_COLORS = {
  Pending: "default",
  Assigned: "blue",
  "In Progress": "processing",
  Completed: "green",
  "On Hold": "orange",
};

export default function WorkerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { jobs, loading } = useWorkerJobs();
  const [jobCards, setJobCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [productivity, setProductivity] = useState(null);
  const [executeForm] = Form.useForm();

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const selectedJobId = searchParams.get("jobId") || "";

  const selectedJob = useMemo(
    () => jobs.find((job) => job._id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  const loadJobCards = async (jobId) => {
    if (!jobId) {
      setJobCards([]);
      setProductivity(null);
      return;
    }
    setCardsLoading(true);
    try {
      const [list, prod] = await Promise.all([
        getMyJobCards(jobId),
        getMyProductivitySummary({ jobId }).catch(() => null),
      ]);
      setJobCards(Array.isArray(list) ? list : []);
      setProductivity(prod);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load job cards");
      setJobCards([]);
      setProductivity(null);
    } finally {
      setCardsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedJobId && jobs.length === 1) {
      setSearchParams({ jobId: jobs[0]._id });
    }
  }, [jobs, selectedJobId, setSearchParams]);

  useEffect(() => {
    loadJobCards(selectedJobId);
  }, [selectedJobId]);

  const openExecuteModal = (card) => {
    setSelectedCard(card);
    executeForm.setFieldsValue({
      status: card.status === "Assigned" ? "In Progress" : card.status || "In Progress",
      actualStart: card.actualStart ? dayjs(card.actualStart) : dayjs(),
      actualEnd: card.actualEnd ? dayjs(card.actualEnd) : null,
      hours: 0,
      workDate: dayjs(),
      notes: "",
      snagIssue: card.snagIssue || "",
      remarks: card.remarks || "",
      ppeVerified: !!card.safetyChecklist?.ppeVerified,
      siteBriefed: !!card.safetyChecklist?.siteBriefed,
      permitsChecked: !!card.safetyChecklist?.permitsChecked,
      equipmentInspected: !!card.safetyChecklist?.equipmentInspected,
    });
    setExecuteOpen(true);
  };

  const closeExecuteModal = () => {
    setExecuteOpen(false);
    setSelectedCard(null);
    executeForm.resetFields();
  };

  const handleExecute = async (values) => {
    if (!selectedCard?._id) return;
    try {
      setSaving(true);
      await executeJobCard(selectedCard._id, {
        status: values.status,
        actualStart: values.actualStart ? values.actualStart.format("YYYY-MM-DD") : "",
        actualEnd: values.actualEnd ? values.actualEnd.format("YYYY-MM-DD") : "",
        snagIssue: values.snagIssue || "",
        remarks: values.remarks || "",
        safetyChecklist: {
          ppeVerified: !!values.ppeVerified,
          siteBriefed: !!values.siteBriefed,
          permitsChecked: !!values.permitsChecked,
          equipmentInspected: !!values.equipmentInspected,
        },
        hoursEntry: {
          workerName: user?.name || "",
          role: "Installer",
          hours: Number(values.hours || 0),
          workDate: values.workDate ? values.workDate.format("YYYY-MM-DD") : "",
          notes: values.notes || "",
        },
      });
      message.success("Job card updated");
      closeExecuteModal();
      await loadJobCards(selectedJobId);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to update job card");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <Title level={3} style={{ marginBottom: 4 }}>My Jobs</Title>
      <Text type="secondary">
        Welcome, {user?.name || "Worker"} — execute installer job cards and chat with your team.
      </Text>

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
                  const mapsUrl = buildMapsLink(nextAssignment, job.site);
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
                      actions={
                        mapsUrl
                          ? [
                              <Button
                                key="maps"
                                size="small"
                                type="link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(mapsUrl, "_blank", "noopener,noreferrer");
                                }}
                              >
                                Maps
                              </Button>,
                            ]
                          : undefined
                      }
                    >
                      <div style={{ width: "100%" }}>
                        <div style={{ fontWeight: 600 }}>{job.jobId}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>{job.customer || "—"}</div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                          {job.site || nextAssignment?.location || "No site address"}
                        </div>
                        {nextAssignment ? (
                          <div style={{ marginTop: 6 }}>
                            <Tag color="blue">{nextAssignment.assignmentType}</Tag>
                            <Tag>{nextAssignment.status}</Tag>
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
          {selectedJob ? (
            <Tabs
              items={[
                {
                  key: "cards",
                  label: "Job Cards",
                  children: (
                    <Card title={`Installer Job Cards — ${selectedJob.jobId}`} loading={cardsLoading}>
                      {selectedJob.site ? (
                        <Space style={{ marginBottom: 12 }} wrap>
                          <Text type="secondary">Site: {selectedJob.site}</Text>
                          <Button
                            size="small"
                            type="link"
                            onClick={() =>
                              window.open(
                                buildMapsLink(null, selectedJob.site),
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            Open in Maps
                          </Button>
                        </Space>
                      ) : null}
                      {productivity?.summary ? (
                        <Space wrap style={{ marginBottom: 16 }}>
                          <Tag color="blue">My hours: {productivity.summary.totalHours}h</Tag>
                          <Tag>Fabrication: {productivity.byWorker?.[0]?.fabricationHours || 0}h</Tag>
                          <Tag>Installation: {productivity.byWorker?.[0]?.installationHours || 0}h</Tag>
                          <Tag>Attendance: {productivity.byWorker?.[0]?.attendanceHours || 0}h</Tag>
                        </Space>
                      ) : null}
                      {jobCards.length === 0 ? (
                        <Text type="secondary">No job cards assigned to you for this project yet.</Text>
                      ) : (
                        <List
                          dataSource={jobCards}
                          renderItem={(card) => (
                            <List.Item
                              actions={[
                                card.status !== "Completed" ? (
                                  <Button type="primary" size="small" onClick={() => openExecuteModal(card)}>
                                    Execute
                                  </Button>
                                ) : (
                                  <Tag color="green">Done</Tag>
                                ),
                              ]}
                            >
                              <List.Item.Meta
                                title={
                                  <Space wrap>
                                    <span>{card.title}</span>
                                    <Tag>{card.cardNumber}</Tag>
                                    <Tag color={STATUS_COLORS[card.status] || "default"}>{card.status}</Tag>
                                  </Space>
                                }
                                description={
                                  <Space direction="vertical" size={4}>
                                    <Text type="secondary">{card.locationArea || selectedJob.site || "—"}</Text>
                                    <Text>
                                      Hours: {Number(card.actualHours || 0)} / {Number(card.expectedHours || 0)}
                                    </Text>
                                    {card.completionCriteria ? (
                                      <Text type="secondary">Done when: {card.completionCriteria}</Text>
                                    ) : null}
                                  </Space>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      )}
                    </Card>
                  ),
                },
                {
                  key: "chat",
                  label: "Team Chat",
                  children: (
                    <Card title={`Team Chat — ${selectedJob.jobId}`}>
                      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
                        {selectedJob.site || "No site address"} · {selectedJob.systemState || "Active"}
                      </Text>
                      <JobChatPanel jobId={selectedJob._id} jobLabel={selectedJob.jobId} />
                    </Card>
                  ),
                },
              ]}
            />
          ) : (
            <Card title="Select a job">
              <Text type="secondary">Choose a job from the left to view job cards and team chat.</Text>
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title={selectedCard ? `Execute — ${selectedCard.cardNumber}` : "Execute Job Card"}
        open={executeOpen}
        onCancel={closeExecuteModal}
        onOk={() => executeForm.submit()}
        confirmLoading={saving}
        okText="Save Progress"
        width={720}
      >
        <Form form={executeForm} layout="vertical" onFinish={handleExecute}>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select>
              <Option value="In Progress">In Progress</Option>
              <Option value="On Hold">On Hold</Option>
              <Option value="Completed">Completed</Option>
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="actualStart" label="Actual Start">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actualEnd" label="Actual End">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left">Time Capture</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="hours" label="Hours (this entry)">
                <InputNumber min={0} step={0.5} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="workDate" label="Work Date">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="notes" label="Work Notes">
                <Input placeholder="Optional" />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left">Safety Checklist</Divider>
          <Row gutter={[8, 8]}>
            <Col span={12}><Form.Item name="ppeVerified" valuePropName="checked"><Checkbox>PPE verified</Checkbox></Form.Item></Col>
            <Col span={12}><Form.Item name="siteBriefed" valuePropName="checked"><Checkbox>Site briefed</Checkbox></Form.Item></Col>
            <Col span={12}><Form.Item name="permitsChecked" valuePropName="checked"><Checkbox>Permits checked</Checkbox></Form.Item></Col>
            <Col span={12}><Form.Item name="equipmentInspected" valuePropName="checked"><Checkbox>Equipment inspected</Checkbox></Form.Item></Col>
          </Row>
          <Form.Item name="snagIssue" label="Snag / Issue">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
