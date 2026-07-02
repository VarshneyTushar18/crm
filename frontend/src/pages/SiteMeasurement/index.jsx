import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';
import dayjs from "dayjs";
import { useJob } from "../../context/JobContext";
import {
  Row,
  Col,
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  DatePicker,
  Descriptions,
  message,
  Divider,
  Space,
  Switch,
  Tag,
  Spin,
  Upload,
  List,
  Alert,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { uploadMeasurementFiles } from "@/api/phase1Api";
import SendForSiteEngineerButton from "@/components/SendForSiteEngineerButton";

const { TextArea } = Input;
const { Option } = Select;

const JOB_API = `${API_BASE_URL}/job`;
const MEASUREMENT_API = `${API_BASE_URL}/measurement`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function SiteMeasurement() {
  const [form] = Form.useForm();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeJobId, setActiveJobId } = useJob();

  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [currentMeasurement, setCurrentMeasurement] = useState(null);

  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);
  const [loadingMeasurement, setLoadingMeasurement] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // ✅ existing measurement -> view mode by default
  const [isEditMode, setIsEditMode] = useState(false);

  const queryJobId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("jobId");
  }, [location.search]);

  const resolvedJobId =
    queryJobId || activeJobId || localStorage.getItem("activeJobId") || null;

  const setCurrentJobContext = (job) => {
    if (!job?._id) return;
    setActiveJobId(job._id);
    localStorage.setItem("activeJobId", job._id);
    localStorage.setItem(`activeJobData_${job._id}`, JSON.stringify(job));
    localStorage.setItem("activeJobData", JSON.stringify(job));
    setSelectedJob(job);
  };

  const currentStageColor = {
    Backlog: "default",
    "Site Measurement": "blue",
    "Planning Lock": "purple",
    Drafting: "orange",
    "Job Scheduling": "gold",
    "Material Purchase": "lime",
    Fabrication: "cyan",
    "Quality Control": "magenta",
    Installation: "green",
    Closure: "volcano",
  };

  const applyMeasurementToForm = (measurement, job) => {
    if (measurement) {
      form.setFieldsValue({
        jobId: typeof measurement.jobId === "object" ? measurement.jobId?._id : measurement.jobId,
        measuredBy: measurement.measuredBy || "",
        siteAddress: measurement.siteAddress || job?.site || "",
        height: measurement.height ?? 0,
        width: measurement.width ?? 0,
        length: measurement.length ?? 0,
        materialType: measurement.materialType || "",
        fixingSurfaces: measurement.fixingSurfaces || "",
        accessDetails: measurement.accessDetails || "",
        parkingDetails: measurement.parkingDetails || "",
        powerAvailable: !!measurement.powerAvailable,
        powerLocation: measurement.powerLocation || "",
        waterAvailable: !!measurement.waterAvailable,
        waterLocation: measurement.waterLocation || "",
        liftAccess: measurement.liftAccess || "",
        washroomAccess: measurement.washroomAccess || "",
        publicRisk: measurement.publicRisk || "",
        whsHazards: measurement.whsHazards || "",
        notes: measurement.notes || "",
        measurementDate: measurement.measurementDate
          ? dayjs(measurement.measurementDate)
          : dayjs(),
        status: measurement.status || "Pending",
      });
    } else {
      form.setFieldsValue({
        jobId: job?._id || selectedJobId,
        measuredBy: "",
        siteAddress: job?.site || "",
        height: 0,
        width: 0,
        length: 0,
        materialType: "",
        fixingSurfaces: "",
        accessDetails: "",
        parkingDetails: "",
        powerAvailable: false,
        powerLocation: "",
        waterAvailable: false,
        waterLocation: "",
        liftAccess: "",
        washroomAccess: "",
        publicRisk: "",
        whsHazards: "",
        notes: "",
        measurementDate: dayjs(),
        status: "Pending",
      });
    }
  };

  const fetchJobs = async () => {
    try {
      setLoadingJobs(true);
      const res = await axios.get(`${JOB_API}/list`, {
        headers: authHeaders(),
      });
      setJobs(Array.isArray(res.data?.result) ? res.data.result : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to load jobs"
      );
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchJob = async (jobObjectId) => {
    if (!jobObjectId) {
      setSelectedJob(null);
      return null;
    }

    try {
      setLoadingJob(true);
      const res = await axios.get(`${JOB_API}/read/${jobObjectId}`, {
        headers: authHeaders(),
      });
      const job = res.data?.result || null;
      if (job) setCurrentJobContext(job);
      else setSelectedJob(null);
      return job;
    } catch (err) {
      setSelectedJob(null);
      message.error(
        err?.response?.data?.message || err?.message || "Failed to load job details"
      );
      return null;
    } finally {
      setLoadingJob(false);
    }
  };

  const fetchMeasurementForJob = async (jobObjectId, jobData = null) => {
    if (!jobObjectId) {
      setCurrentMeasurement(null);
      form.resetFields();
      setIsEditMode(false);
      return;
    }

    try {
      setLoadingMeasurement(true);

      const res = await axios.get(`${MEASUREMENT_API}/list`, {
        headers: authHeaders(),
      });

      const allMeasurements = Array.isArray(res.data?.result) ? res.data.result : [];

      const existing = allMeasurements.find((item) => {
        const linkedId =
          typeof item?.jobId === "object" ? item?.jobId?._id : item?.jobId;
        return linkedId === jobObjectId;
      });

      setCurrentMeasurement(existing || null);

      const job = jobData || selectedJob;
      applyMeasurementToForm(existing || null, job);

      // ✅ existing record -> readonly mode
      // ✅ no record -> edit mode for create
      setIsEditMode(!existing);
    } catch (err) {
      setCurrentMeasurement(null);
      form.resetFields();
      setIsEditMode(false);
      message.error(
        err?.response?.data?.message || err?.message || "Failed to load measurement"
      );
    } finally {
      setLoadingMeasurement(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    const incomingJob = location.state?.job || location.state?.fromJob;
    if (incomingJob?._id) {
      setCurrentJobContext(incomingJob);
      setSelectedJobId(incomingJob._id);
      if (!queryJobId) {
        navigate(`/admin/site-measurement?jobId=${incomingJob._id}`, {
          replace: true,
          state: location.state,
        });
      }
      return;
    }

    if (resolvedJobId) {
      setSelectedJobId(resolvedJobId);
      if (!queryJobId) {
        navigate(`/admin/site-measurement?jobId=${resolvedJobId}`, { replace: true });
      }
    }
  }, [queryJobId, resolvedJobId, location.state]);

  useEffect(() => {
    if (!selectedJobId) return;

    const run = async () => {
      const job = await fetchJob(selectedJobId);
      await fetchMeasurementForJob(selectedJobId, job);
    };

    run();
  }, [selectedJobId]);

  const onJobChange = (jobObjectId) => {
    setSelectedJobId(jobObjectId || null);
    if (jobObjectId) {
      const job = jobs.find((j) => j._id === jobObjectId);
      if (job) setCurrentJobContext(job);
      navigate(`/admin/site-measurement?jobId=${jobObjectId}`);
    } else {
      setActiveJobId("");
      localStorage.removeItem("activeJobId");
      navigate(`/admin/site-measurement`);
      setSelectedJob(null);
      setCurrentMeasurement(null);
      form.resetFields();
      setIsEditMode(false);
    }
  };

  const onSubmit = async (values) => {
    if (!selectedJobId) {
      message.warning("Please select a job first");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...values,
        jobId: selectedJobId,
        measurementDate: values.measurementDate
          ? values.measurementDate.format("YYYY-MM-DD")
          : null,
      };

      if (currentMeasurement?._id) {
        await axios.patch(
          `${MEASUREMENT_API}/update/${currentMeasurement._id}`,
          payload,
          { headers: authHeaders() }
        );
        message.success("Site measurement updated");
      } else {
        await axios.post(`${MEASUREMENT_API}/create`, payload, {
          headers: authHeaders(),
        });
        message.success("Site measurement saved");
      }

      const refreshedJob = await fetchJob(selectedJobId);
      await fetchMeasurementForJob(selectedJobId, refreshedJob);
      setIsEditMode(false);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to save measurement"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    applyMeasurementToForm(currentMeasurement, selectedJob);
    setIsEditMode(false);
  };

  const handleResetNew = () => {
    applyMeasurementToForm(null, selectedJob);
  };

  const completeSiteMeasurement = async () => {
    if (!selectedJobId) {
      message.warning("Please select a job first");
      return;
    }
    if (!currentMeasurement?._id) {
      message.warning("Save the measurement first, then complete it");
      return;
    }

    try {
      setCompleting(true);
      await axios.patch(
        `${MEASUREMENT_API}/update/${currentMeasurement._id}`,
        { status: "Completed" },
        { headers: authHeaders() }
      );
      message.success("Site measurement sent to Site Engineer for approval");
      const refreshedJob = await fetchJob(selectedJobId);
      await fetchMeasurementForJob(selectedJobId, refreshedJob);
      setIsEditMode(false);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to complete measurement"
      );
    } finally {
      setCompleting(false);
    }
  };

  const measurementComplete = Boolean(
    selectedJob?.workflowEvents?.siteMeasurement?.isCompleted ||
      currentMeasurement?.status === "Completed"
  );

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginBottom: 4 }}>Site Measurement</h2>
          <div style={{ color: "#666" }}>
            Search job or open directly from Jobs page.
          </div>
        </div>

        <Space wrap>
          <Button onClick={() => navigate("/admin/jobs")}>Back to Jobs</Button>
          {selectedJob?._id && (
            <Button onClick={() => navigate(`/admin/planning?jobId=${selectedJob._id}`)}>
              Go to Planning
            </Button>
          )}
          {selectedJob?._id && (
            <SendForSiteEngineerButton
              jobId={selectedJob._id}
              stageKey="siteMeasurement"
              workflowEvents={selectedJob?.workflowEvents}
              disabled={!currentMeasurement?._id}
              disabledReason="Save the measurement first"
              onSent={(job) => {
                if (job) setSelectedJob(job);
              }}
            />
          )}
          {selectedJob?._id && (
            <Button onClick={() => navigate(`/admin/job/${selectedJob._id}`)}>
              View Job Timeline
            </Button>
          )}
          {currentMeasurement?._id && !measurementComplete ? (
            <Button type="primary" onClick={completeSiteMeasurement} loading={completing}>
              Complete Site Measurement
            </Button>
          ) : null}
        </Space>
      </div>

      {selectedJob && currentMeasurement && !measurementComplete ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Measurement saved but not completed"
          description='Click "Complete Site Measurement" to send this stage to Site Engineer for approval.'
        />
      ) : null}

      {selectedJob ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <span>
              <strong>Active project:</strong> {selectedJob.jobId} — {selectedJob.customer || "Customer"}
              {selectedJob.site ? ` @ ${selectedJob.site}` : ""}
            </span>
          }
          description={
            <Space wrap size="middle">
              <span>
                Stage:{" "}
                <Tag color={currentStageColor[selectedJob.stage] || "blue"}>
                  {selectedJob.stage || "Site Measurement"}
                </Tag>
              </span>
              <span>
                Measurement:{" "}
                {currentMeasurement ? (
                  <Tag color="green">Saved</Tag>
                ) : (
                  <Tag color="orange">New — not saved yet</Tag>
                )}
              </span>
            </Space>
          }
        />
      ) : (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No project selected"
          description="Open this page from Jobs → View Timeline, or pick a job below."
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12} lg={10}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Search Job</div>
            <Select
              showSearch
              allowClear
              placeholder="Select job"
              style={{ width: "100%" }}
              value={selectedJobId || resolvedJobId || undefined}
              onChange={onJobChange}
              loading={loadingJobs}
              optionFilterProp="children"
            >
              {jobs.map((job) => (
                <Option key={job._id} value={job._id}>
                  {job.jobId} - {job.customer || "No customer"}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} md={12} lg={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Current Selection</div>
            <Input
              readOnly
              value={
                selectedJob
                  ? `${selectedJob.jobId || "-"} | ${selectedJob.customer || "-"}`
                  : ""
              }
              placeholder="No job selected"
            />
          </Col>

          <Col xs={24} lg={6}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Measurement Status</div>
            {currentMeasurement ? (
              <Tag color="green">Measurement Saved</Tag>
            ) : (
              <Tag color="orange">New Measurement</Tag>
            )}
          </Col>
        </Row>
      </Card>

      {loadingJob ? (
        <Card>
          <Spin />
        </Card>
      ) : selectedJob ? (
        <>
          <Card title="Job Details" style={{ marginBottom: 16 }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Job ID">
                {selectedJob.jobId || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {selectedJob.customer || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Site" span={2}>
                {selectedJob.site || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Stage">
                <Tag color={currentStageColor[selectedJob.stage] || "default"}>
                  {selectedJob.stage || "-"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {selectedJob.status || "-"}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={currentMeasurement ? "Site Measurement Details" : "Create Site Measurement"}
            extra={
              currentMeasurement ? (
                !isEditMode ? (
                  <Button type="primary" onClick={handleEdit}>
                    Edit Measurement
                  </Button>
                ) : (
                  <Space>
                    <Button onClick={handleCancelEdit}>Cancel Edit</Button>
                  </Space>
                )
              ) : null
            }
          >
            <Form form={form} layout="vertical" onFinish={onSubmit}>
              <Form.Item name="jobId" hidden>
                <Input />
              </Form.Item>

              <Divider orientation="left">Basic Details</Divider>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item label="Measured By" name="measuredBy">
                    <Input
                      placeholder="Worker / Admin name"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item label="Measurement Date" name="measurementDate">
                    <DatePicker
                      style={{ width: "100%" }}
                      format="YYYY-MM-DD"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item label="Status" name="status">
                    <Select disabled={currentMeasurement && !isEditMode}>
                      <Option value="Pending">Pending</Option>
                      <Option value="Completed">Completed</Option>
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item label="Site Address" name="siteAddress">
                    <TextArea
                      rows={2}
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left">Measurements</Divider>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item label="Height (mm)" name="height">
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item label="Width (mm)" name="width">
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item label="Length (mm)" name="length">
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item label="Material Type" name="materialType">
                    <Input
                      placeholder="Glass / Steel / Aluminium"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item label="Fixing Surfaces" name="fixingSurfaces">
                    <Input
                      placeholder="Wall / Floor / Slab etc."
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left">Checklist / Site Conditions</Divider>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item label="Access Details" name="accessDetails">
                    <TextArea
                      rows={3}
                      placeholder="Site access details"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item label="Parking Details" name="parkingDetails">
                    <TextArea
                      rows={3}
                      placeholder="Parking / loading notes"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item label="Public Risk" name="publicRisk">
                    <TextArea
                      rows={3}
                      placeholder="Public risk observations"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="WHS Hazards" name="whsHazards">
                    <TextArea
                      rows={3}
                      placeholder="Hazards / safety notes"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Notes" name="notes">
                    <TextArea
                      rows={3}
                      placeholder="Additional notes"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>

                  {currentMeasurement?._id && (
                    <Form.Item label="Files (JPEG / PDF / Drawings)">
                      <Upload
                        multiple
                        beforeUpload={() => false}
                        onChange={async (info) => {
                          const files = info.fileList
                            .map((f) => f.originFileObj)
                            .filter(Boolean);
                          if (!files.length) return;
                          try {
                            const res = await uploadMeasurementFiles(
                              currentMeasurement._id,
                              files
                            );
                            setCurrentMeasurement(res.data.result);
                            message.success(res.data.message || "Files uploaded");
                          } catch (err) {
                            message.error(
                              err?.response?.data?.message || "Upload failed"
                            );
                          }
                        }}
                      >
                        <Button icon={<UploadOutlined />}>Upload files</Button>
                      </Upload>
                      <List
                        size="small"
                        style={{ marginTop: 8 }}
                        dataSource={currentMeasurement.photoUrls || []}
                        renderItem={(url) => (
                          <List.Item>
                            <a href={url.startsWith("http") ? url : `${API_BASE_URL.replace("/api", "")}${url}`} target="_blank" rel="noreferrer">
                              {url}
                            </a>
                          </List.Item>
                        )}
                      />
                    </Form.Item>
                  )}
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item
                    label="Power Available"
                    name="powerAvailable"
                    valuePropName="checked"
                  >
                    <Switch disabled={currentMeasurement && !isEditMode} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item label="Power Location" name="powerLocation">
                    <Input
                      placeholder="Describe power location"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item
                    label="Water Available"
                    name="waterAvailable"
                    valuePropName="checked"
                  >
                    <Switch disabled={currentMeasurement && !isEditMode} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item label="Water Location" name="waterLocation">
                    <Input
                      placeholder="Describe water location"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Lift Access" name="liftAccess">
                    <Input
                      placeholder="Describe lift access"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Washroom Access" name="washroomAccess">
                    <Input
                      placeholder="Describe washroom access"
                      disabled={currentMeasurement && !isEditMode}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              {!currentMeasurement ? (
                <Space>
                  <Button type="primary" htmlType="submit" loading={saving}>
                    Save Measurement
                  </Button>

                  <Button onClick={handleResetNew}>Reset Form</Button>
                </Space>
              ) : isEditMode ? (
                <Space>
                  <Button type="primary" htmlType="submit" loading={saving}>
                    Update Measurement
                  </Button>

                  <Button onClick={handleCancelEdit}>Cancel Edit</Button>
                </Space>
              ) : (
                <Tag color="blue">Measurement is saved. Click Edit Measurement to modify.</Tag>
              )}
            </Form>
          </Card>
        </>
      ) : (
        <Card>
          <div>Please select a job to continue.</div>
        </Card>
      )}

      {loadingMeasurement && (
        <div style={{ marginTop: 12 }}>
          <Spin size="small" /> Loading measurement...
        </div>
      )}
    </div>
  );
}