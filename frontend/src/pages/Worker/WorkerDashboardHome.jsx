import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Calendar,
  Card,
  Col,
  Divider,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Spin,
} from "antd";
import {
  EnvironmentOutlined,
  ClockCircleOutlined,
  ProjectOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import LivenessPromptModal from "@/components/LivenessPromptModal";
import { getAttendanceHistory } from "@/api/workerAttendanceApi";
import { getMyLeaves } from "@/pages/Leave/leaveApi";
import { useWorkerJobs } from "@/pages/Worker/useWorkerJobs";
import { useWorkerAttendance } from "@/pages/Worker/useWorkerAttendance";
import {
  assignmentScheduledMs,
  computeMonthAttendanceStats,
  dayAttendanceStatus,
  getTimeGreeting,
  todayWorkedMsFromHistory,
} from "@/pages/Worker/workerDashboardStats";
import { formatElapsedFriendly } from "@/pages/Worker/useWorkerAttendance";
import { buildMapsLink } from "@/pages/Worker/workerUtils";
import { WORKER_ATTENDANCE_CELL_STYLES } from "@/utils/leaveCalendarStyles";

const { Title, Text } = Typography;

const STATUS_CELL_STYLES = WORKER_ATTENDANCE_CELL_STYLES;

export default function WorkerDashboardHome() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const { jobs, loading: jobsLoading, todayAssignments, upcomingAssignments } = useWorkerJobs();
  const [history, setHistory] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(dayjs());

  const primaryToday = todayAssignments[0] || null;
  const nextUpcoming = upcomingAssignments[0] || null;
  const nextUpcomingJob = useMemo(() => {
    if (!nextUpcoming?.job_id) return null;
    return jobs.find((j) => j._id === nextUpcoming.job_id) || null;
  }, [jobs, nextUpcoming]);
  const primaryJob = useMemo(() => {
    if (!primaryToday?.job_id) return null;
    return jobs.find((j) => j._id === primaryToday.job_id) || null;
  }, [jobs, primaryToday]);

  const siteSupervisor = useMemo(() => {
    if (!primaryJob?.assignments?.length) return null;
    const se = primaryJob.assignments.find(
      (a) => String(a.role || "").toLowerCase().includes("site engineer")
    );
    return se?.assigneeName || null;
  }, [primaryJob]);

  const scheduledTodayMs = useMemo(() => {
    return todayAssignments.reduce((sum, a) => sum + assignmentScheduledMs(a), 0);
  }, [todayAssignments]);

  const jobIdForCheckIn = primaryToday?.job_id || "";

  const attendance = useWorkerAttendance({
    jobId: jobIdForCheckIn,
    onChanged: () => loadHistory(),
  });

  const loadHistory = async () => {
    try {
      const [list, leaveList] = await Promise.all([
        getAttendanceHistory(),
        getMyLeaves().catch(() => []),
      ]);
      setHistory(Array.isArray(list) ? list : []);
      setLeaves(Array.isArray(leaveList) ? leaveList : []);
    } catch {
      setHistory([]);
      setLeaves([]);
    }
  };

  useEffect(() => {
    setDataLoading(true);
    loadHistory().finally(() => setDataLoading(false));
  }, []);

  useEffect(() => {
    const onRefresh = () => loadHistory();
    window.addEventListener("worker-attendance-changed", onRefresh);
    return () => window.removeEventListener("worker-attendance-changed", onRefresh);
  }, []);

  const monthStats = useMemo(
    () => computeMonthAttendanceStats(history, leaves, calendarMonth),
    [history, leaves, calendarMonth]
  );

  const workedTodayMs = useMemo(
    () =>
      todayWorkedMsFromHistory(
        history,
        attendance.checkedIn,
        attendance.checkInAt,
        attendance.elapsedMs
      ),
    [history, attendance.checkedIn, attendance.checkInAt, attendance.elapsedMs]
  );

  const remainingMs = Math.max(0, scheduledTodayMs - workedTodayMs);

  const jobSiteMap = useMemo(() => {
    const map = new Map();
    for (const job of jobs) {
      map.set(String(job._id), {
        label: job.jobId || "Job",
        site: job.site || "",
      });
    }
    return map;
  }, [jobs]);

  const recentRows = useMemo(() => {
    const byDay = new Map();
    for (const session of history) {
      if (!session?.checkInTime) continue;
      const dayKey = dayjs(session.checkInTime).format("YYYY-MM-DD");
      if (!byDay.has(dayKey)) byDay.set(dayKey, session);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([dayKey, session]) => {
        const jobMeta = jobSiteMap.get(String(session.jobId || ""));
        const site =
          jobMeta?.site ||
          jobMeta?.label ||
          (session.jobId ? `Job ${session.jobId}` : "General / off-site");
        let status = "Present";
        if (session.status === "checked_in" && dayjs(session.checkInTime).isSame(dayjs(), "day")) {
          status = "In progress";
        }
        return {
          key: dayKey,
          date: dayjs(dayKey).format("MMM D"),
          site,
          status,
        };
      });
  }, [history, jobSiteMap]);

  const calendarFullCellRender = (date, info) => {
    if (info.type !== "date") return info.originNode;
    const dayStr = date.format("YYYY-MM-DD");
    const status = dayAttendanceStatus(dayStr, monthStats);
    const cellStyle = STATUS_CELL_STYLES[status];
    return (
      <div
        className="ant-picker-cell-inner worker-attendance-calendar__cell"
        style={
          cellStyle
            ? {
                borderRadius: 6,
                margin: "0 2px",
                minHeight: 28,
                lineHeight: "28px",
                ...cellStyle,
              }
            : undefined
        }
      >
        {date.date()}
      </div>
    );
  };

  const mapsUrl = primaryToday
    ? buildMapsLink(primaryToday, primaryJob?.site)
    : null;

  const attendancePanel = (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        background: attendance.checkedIn ? "#f0fdf4" : "#f8fafc",
        border: `1px solid ${attendance.checkedIn ? "#86efac" : "#e2e8f0"}`,
      }}
    >
      <Text strong style={{ display: "block", marginBottom: 8 }}>Today&apos;s attendance</Text>
      {attendance.checkedIn ? (
        <>
          <Text strong style={{ fontSize: 16, color: "#15803d" }}>
            Clock in: {dayjs(attendance.checkInAt).format("hh:mm A")}
          </Text>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">Working: {attendance.elapsedFriendly}</Text>
          </div>
        </>
      ) : (
        <Text type="secondary">You are not clocked in yet.</Text>
      )}
      <div style={{ marginTop: 16 }}>
        {!attendance.checkedIn ? (
          <Button
            type="primary"
            size="large"
            block
            loading={attendance.loading}
            onClick={() => attendance.setLivenessOpen(true)}
          >
            Clock in
          </Button>
        ) : (
          <Button
            danger
            size="large"
            block
            loading={attendance.loading}
            onClick={attendance.confirmCheckOut}
          >
            Clock out
          </Button>
        )}
      </div>
    </div>
  );

  const topColSpan = primaryToday ? 14 : 12;

  return (
    <div className="page-shell dashboard-page">
      <Title level={3} className="dashboard-section-title" style={{ marginBottom: 4 }}>
        {getTimeGreeting()}, {user?.name || "Worker"} 👋
      </Title>
      <Text type="secondary">Here is your day at a glance.</Text>

      <Row gutter={[16, 16]} style={{ marginTop: 20 }} align="stretch">
        <Col xs={24} lg={topColSpan}>
          <Card
            title="Today's work"
            loading={jobsLoading}
            className="whiteBox shadow"
            style={{ height: "100%" }}
            extra={
              <Button type="link" size="small" onClick={() => navigate("/worker/jobs")}>
                All jobs
              </Button>
            }
          >
            {!primaryToday ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Space direction="vertical" size={4}>
                      <Text strong>No assignments today</Text>
                      <Text type="secondary">
                        You can still mark attendance or check your schedule.
                      </Text>
                    </Space>
                  }
                >
                  <Space wrap>
                    <Button onClick={() => navigate("/worker/schedule")}>View schedule</Button>
                    <Button type="primary" onClick={() => navigate("/worker/jobs")}>
                      My jobs
                    </Button>
                  </Space>
                </Empty>

                {nextUpcoming ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 12 }}>Next up</Text>
                    <div style={{ marginTop: 6 }}>
                      <Text strong>
                        {dayjs(nextUpcoming.startTime).format("ddd, D MMM · hh:mm A")}
                      </Text>
                    </div>
                    <Text>
                      {nextUpcoming.title}
                      {nextUpcoming.jobCode ? (
                        <Tag style={{ marginLeft: 8 }}>{nextUpcoming.jobCode}</Tag>
                      ) : null}
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" ellipsis>
                        {nextUpcoming.location ||
                          nextUpcomingJob?.site ||
                          "Location to be confirmed"}
                      </Text>
                    </div>
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, marginTop: 8 }}
                      onClick={() =>
                        navigate(
                          `/worker/jobs?jobId=${encodeURIComponent(nextUpcoming.job_id)}`
                        )
                      }
                    >
                      Open job
                    </Button>
                  </div>
                ) : null}
              </Space>
            ) : (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <div>
                  <Space align="start">
                    <ProjectOutlined style={{ fontSize: 18, color: "#339393", marginTop: 4 }} />
                    <div>
                      <Text strong style={{ fontSize: 16 }}>
                        {primaryJob?.jobId || primaryToday.jobCode || primaryToday.title}
                      </Text>
                      <div>
                        <Text type="secondary">{primaryToday.title}</Text>
                      </div>
                    </div>
                  </Space>
                </div>
                <Text>
                  <EnvironmentOutlined />{" "}
                  {primaryToday.location || primaryJob?.site || "Site address not set"}
                </Text>
                {siteSupervisor ? (
                  <Text type="secondary">Site engineer: {siteSupervisor}</Text>
                ) : (
                  <Text type="secondary">
                    Role: {primaryToday.role || primaryToday.assignmentType || "—"}
                  </Text>
                )}
                <Text>
                  <ClockCircleOutlined /> Shift:{" "}
                  {dayjs(primaryToday.startTime).format("hh:mm A")} –{" "}
                  {dayjs(primaryToday.endTime).format("hh:mm A")}
                </Text>
                {mapsUrl ? (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0 }}
                    onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}
                  >
                    Open in Maps
                  </Button>
                ) : null}
              </Space>
            )}

            <Divider style={{ margin: "16px 0" }} />
            {attendancePanel}
          </Card>
        </Col>

        <Col xs={24} lg={primaryToday ? 10 : 12}>
          <Card title="Today's hours" className="whiteBox shadow">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Scheduled"
                  value={formatElapsedFriendly(scheduledTodayMs)}
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Worked"
                  value={formatElapsedFriendly(workedTodayMs)}
                  valueStyle={{ fontSize: 18, color: "#339393" }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Remaining"
                  value={formatElapsedFriendly(remainingMs)}
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
            </Row>
          </Card>

          <Card title="My attendance" style={{ marginTop: 16 }} className="whiteBox shadow" loading={dataLoading}>
            <Space size="large" wrap>
              <Statistic title="Present" value={monthStats.present} />
              <Statistic title="Absent" value={monthStats.absent} />
              <Statistic title="Leave" value={monthStats.leave} />
            </Space>
            <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
              {calendarMonth.format("MMMM YYYY")} (weekdays only for absent)
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Attendance calendar" className="whiteBox shadow worker-attendance-calendar">
            {dataLoading ? (
              <Spin />
            ) : (
              <Calendar
                fullscreen={false}
                value={calendarMonth}
                onPanelChange={(value) => setCalendarMonth(value)}
                fullCellRender={calendarFullCellRender}
              />
            )}
            <Space wrap style={{ marginTop: 8 }}>
              <Tag color="green">Present</Tag>
              <Tag color="gold">Leave</Tag>
              <Tag color="red">Absent</Tag>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="Recent attendance"
            className="whiteBox shadow"
            extra={
              <Button type="link" size="small" onClick={() => navigate("/worker/attendance")}>
                View all
              </Button>
            }
          >
            <Table
              size="small"
              pagination={false}
              dataSource={recentRows}
              columns={[
                { title: "Date", dataIndex: "date", width: 90 },
                { title: "Site / Job", dataIndex: "site", ellipsis: true },
                {
                  title: "Status",
                  dataIndex: "status",
                  width: 110,
                  render: (v) => (
                    <Tag color={v === "In progress" ? "processing" : "success"}>{v}</Tag>
                  ),
                },
              ]}
              locale={{ emptyText: "No attendance records yet" }}
            />
          </Card>
        </Col>
      </Row>

      <LivenessPromptModal
        open={attendance.livenessOpen}
        onCancel={() => attendance.setLivenessOpen(false)}
        onPassed={attendance.completeCheckIn}
      />
    </div>
  );
}
