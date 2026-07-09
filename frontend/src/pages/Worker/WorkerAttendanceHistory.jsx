import { useEffect, useState } from "react";
import { Button, Empty, Image, Space, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { getAttendanceHistory } from "@/api/workerAttendanceApi";
import { buildFileUrl } from "@/config/serverApiConfig";

const { Text } = Typography;

const formatMinutes = (mins) => {
  const m = Math.max(0, Number(mins || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${String(rem).padStart(2, "0")}m`;
};

export default function WorkerAttendanceHistory() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getAttendanceHistory();
      setRows(Array.isArray(list) ? list : []);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load attendance history");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const columns = [
    {
      title: "Check-in",
      dataIndex: "checkInTime",
      render: (v) => (v ? dayjs(v).format("DD MMM YYYY HH:mm:ss") : "-"),
    },
    {
      title: "Check-out",
      dataIndex: "checkOutTime",
      render: (v) => (v ? dayjs(v).format("DD MMM YYYY HH:mm:ss") : "—"),
    },
    {
      title: "Duration",
      render: (_, row) => {
        if (row.status === "checked_in") return <Tag color="green">In progress</Tag>;
        return formatMinutes(row.totalMinutes);
      },
    },
    {
      title: "Photo (in)",
      render: (_, row) =>
        row.checkInPhotoUrl ? (
          <Image
            src={buildFileUrl(row.checkInPhotoUrl)}
            width={40}
            height={40}
            style={{ objectFit: "cover", borderRadius: 4 }}
          />
        ) : (
          "-"
        ),
    },
    {
      title: "Photo (out)",
      render: (_, row) =>
        row.checkOutPhotoUrl ? (
          <Image
            src={buildFileUrl(row.checkOutPhotoUrl)}
            width={40}
            height={40}
            style={{ objectFit: "cover", borderRadius: 4 }}
          />
        ) : (
          "-"
        ),
    },
    {
      title: "GPS (in)",
      render: (_, row) =>
        row.checkInLatitude != null && row.checkInLongitude != null
          ? `${Number(row.checkInLatitude).toFixed(5)}, ${Number(row.checkInLongitude).toFixed(5)}`
          : "-",
    },
    {
      title: "Liveness",
      render: (_, row) =>
        row.livenessPassed ? (
          <Tag color="green">Pass {row.livenessScore || 0}%</Tag>
        ) : (
          <Tag>N/A</Tag>
        ),
    },
    {
      title: "Face match",
      dataIndex: "faceMatchStatus",
      render: (v) => <Tag>{v || "skipped"}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (v) => (
        <Tag color={v === "checked_in" ? "processing" : "default"}>
          {v === "checked_in" ? "Checked in" : "Checked out"}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <Text strong>Attendance Audit Trail</Text>
          <div>
            <Text type="secondary">
              Time, GPS, selfie photos, and liveness logs for each check-in / check-out.
            </Text>
          </div>
        </div>
        <Button onClick={load} loading={loading}>
          Refresh
        </Button>
      </Space>

      {!loading && !rows.length ? (
        <Empty description="No attendance records yet" />
      ) : (
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={{ pageSize: 8 }}
          scroll={{ x: "max-content" }}
          size="small"
        />
      )}
    </div>
  );
}
