import { Button, Card, List, Space, Tag, Tabs, Typography } from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useWorkerJobs } from "@/pages/Worker/useWorkerJobs";
import { buildMapsLink } from "@/pages/Worker/workerUtils";

const { Title, Text } = Typography;

export default function WorkerSchedulePage() {
  const navigate = useNavigate();
  const { loading, todayAssignments, upcomingAssignments } = useWorkerJobs();

  const openJob = (jobId) => {
    navigate(`/worker/jobs?jobId=${encodeURIComponent(jobId)}`);
  };

  return (
    <div className="page-shell">
      <Title level={3} style={{ marginBottom: 4 }}>Schedule</Title>
      <Text type="secondary">Today and upcoming assignments for the next 7 days.</Text>

      <Card title="My Schedule" style={{ marginTop: 16 }} loading={loading}>
        <Tabs
          size="small"
          items={[
            {
              key: "today",
              label: `Today (${todayAssignments.length})`,
              children: todayAssignments.length ? (
                <List
                  dataSource={todayAssignments}
                  renderItem={(item) => {
                    const mapsUrl = buildMapsLink(item, item.site);
                    return (
                      <List.Item
                        actions={[
                          mapsUrl ? (
                            <Button
                              size="small"
                              type="link"
                              onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}
                            >
                              Maps
                            </Button>
                          ) : null,
                          <Button size="small" onClick={() => openJob(item.job_id)}>
                            Open Job
                          </Button>,
                        ].filter(Boolean)}
                      >
                        <List.Item.Meta
                          title={
                            <Space wrap>
                              <span>{item.title}</span>
                              <Tag color="blue">{item.jobCode}</Tag>
                              <Tag>P{item.priority || 3}</Tag>
                            </Space>
                          }
                          description={
                            <Space direction="vertical" size={2}>
                              <Text type="secondary">
                                {dayjs(item.startTime).format("HH:mm")} –{" "}
                                {dayjs(item.endTime).format("HH:mm")} · {item.status}
                              </Text>
                              <Text>{item.location || item.site || "No site address"}</Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Text type="secondary">No assignments scheduled for today.</Text>
              ),
            },
            {
              key: "upcoming",
              label: `Next 7 days (${upcomingAssignments.length})`,
              children: upcomingAssignments.length ? (
                <List
                  dataSource={upcomingAssignments}
                  renderItem={(item) => {
                    const mapsUrl = buildMapsLink(item, item.site);
                    return (
                      <List.Item
                        actions={[
                          mapsUrl ? (
                            <Button
                              size="small"
                              type="link"
                              onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}
                            >
                              Maps
                            </Button>
                          ) : null,
                          <Button size="small" onClick={() => openJob(item.job_id)}>
                            Open Job
                          </Button>,
                        ].filter(Boolean)}
                      >
                        <List.Item.Meta
                          title={
                            <Space wrap>
                              <span>{item.title}</span>
                              <Tag>{item.jobCode}</Tag>
                            </Space>
                          }
                          description={
                            <Text type="secondary">
                              {dayjs(item.startTime).format("ddd DD MMM HH:mm")} ·{" "}
                              {item.location || item.site || "—"}
                            </Text>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Text type="secondary">No upcoming assignments in the next 7 days.</Text>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
