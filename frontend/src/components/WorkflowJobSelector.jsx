import { Alert, Button, Card, Col, Input, Row, Select, Space } from "antd";
import { useNavigate } from "react-router-dom";
import { useJob } from "@/context/JobContext";
import { withPinnedJob } from "@/utils/workflowJobScope";

const { Option } = Select;

export default function WorkflowJobSelector({
  basePath,
  jobs = [],
  eligibleJobs = [],
  jobId,
  jobData,
  loadingJobs,
  onJobChange,
  pickerLabel = "Search Job",
  pinnedTitle = "Active job from timeline",
  statusSlot = null,
}) {
  const navigate = useNavigate();
  const { isJobPinned, clearJobPin } = useJob();

  const pickerJobs = withPinnedJob(jobs, eligibleJobs, jobId);

  if (isJobPinned && jobId && jobData) {
    return (
      <Card style={{ marginBottom: 16 }}>
        <Alert
          type="info"
          showIcon
          message={`${pinnedTitle}: ${jobData.jobId}`}
          description={
            <div>
              <div>
                <strong>Customer:</strong> {jobData.customer || "—"}
              </div>
              <div>
                <strong>Site:</strong> {jobData.site || "—"}
              </div>
            </div>
          }
          action={
            <Space direction="vertical" size={4}>
              <Button size="small" onClick={() => navigate(`/admin/job/${jobId}`)}>
                View Timeline
              </Button>
              <Button
                size="small"
                onClick={() => {
                  clearJobPin();
                  navigate(basePath);
                }}
              >
                Change Job
              </Button>
            </Space>
          }
        />
        {statusSlot ? <div style={{ marginTop: 12 }}>{statusSlot}</div> : null}
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={12} lg={10}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>{pickerLabel}</div>
          <Select
            showSearch
            allowClear
            placeholder="Select job"
            style={{ width: "100%" }}
            value={jobId || undefined}
            onChange={onJobChange}
            loading={loadingJobs}
            optionFilterProp="children"
          >
            {pickerJobs.map((job) => (
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
              jobData ? `${jobData.jobId || "-"} | ${jobData.customer || "-"}` : ""
            }
            placeholder="No job selected"
          />
        </Col>

        {statusSlot ? <Col xs={24} lg={6}>{statusSlot}</Col> : null}
      </Row>
    </Card>
  );
}
