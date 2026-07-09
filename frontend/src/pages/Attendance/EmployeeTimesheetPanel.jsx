import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Image,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import axios from "axios";
import { API_BASE_URL, buildFileUrl } from "@/config/serverApiConfig";
import { deleteAttendancePhotos } from "@/api/workerAttendanceApi";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const authHeaders = () => {
  const token =
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("authToken") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatMinutes = (mins) => {
  const m = Math.max(0, Number(mins || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${String(rem).padStart(2, "0")}m`;
};

export default function EmployeeTimesheetPanel() {
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState();
  const [workerId, setWorkerId] = useState("");
  const [range, setRange] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 300 };
      if (status) params.status = status;
      if (workerId.trim()) params.workerId = workerId.trim();
      if (range?.[0]) params.from = range[0].startOf("day").toISOString();
      if (range?.[1]) params.to = range[1].endOf("day").toISOString();

      const res = await axios.get(`${API_BASE_URL}/attendance/timesheet`, {
        headers: authHeaders(),
        params,
      });
      setRows(Array.isArray(res.data?.result) ? res.data.result : []);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load timesheet");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDeletePhotos = async (row, which) => {
    const id = row?._id;
    if (!id) return;
    setDeletingId(`${id}-${which}`);
    try {
      const data = await deleteAttendancePhotos(id, which);
      message.success(data?.message || "Photo(s) deleted");
      const updated = data?.result;
      if (updated?._id) {
        setRows((prev) => prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r)));
      } else {
        await load();
      }
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to delete photo(s)");
    } finally {
      setDeletingId("");
    }
  };

  const photoCell = (url, row, which) => {
    if (!url) return "-";
    const busy = deletingId === `${row._id}-${which}` || deletingId === `${row._id}-both`;
    return (
      <Space size={4} align="center">
        <Image
          src={buildFileUrl(url)}
          width={48}
          height={48}
          style={{ objectFit: "cover", borderRadius: 6 }}
        />
        <Popconfirm
          title={`Delete ${which === "in" ? "check-in" : "check-out"} photo?`}
          okText="Delete"
          okButtonProps={{ danger: true }}
          onConfirm={() => handleDeletePhotos(row, which)}
        >
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={busy}
            title="Delete photo"
          />
        </Popconfirm>
      </Space>
    );
  };

  const columns = [
    {
      title: "Employee",
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.workerName || "-"}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.workerId || "-"} · {row.workerEmail || "-"}
          </Text>
        </div>
      ),
    },
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
      title: "Hours",
      render: (_, row) =>
        row.status === "checked_in" ? (
          <Tag color="processing">On shift</Tag>
        ) : (
          formatMinutes(row.totalMinutes)
        ),
    },
    {
      title: "Check-in photo",
      render: (_, row) => photoCell(row.checkInPhotoUrl, row, "in"),
    },
    {
      title: "Check-out photo",
      render: (_, row) => photoCell(row.checkOutPhotoUrl, row, "out"),
    },
    {
      title: "GPS (in)",
      render: (_, row) =>
        row.checkInLatitude != null
          ? `${Number(row.checkInLatitude).toFixed(4)}, ${Number(row.checkInLongitude).toFixed(4)}`
          : "-",
    },
    {
      title: "Liveness",
      render: (_, row) =>
        row.livenessPassed ? (
          <Tag color="green">{row.livenessScore || 0}%</Tag>
        ) : (
          <Tag>N/A</Tag>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (v) => (
        <Tag color={v === "checked_in" ? "green" : "default"}>
          {v === "checked_in" ? "Checked in" : "Checked out"}
        </Tag>
      ),
    },
    {
      title: "Photos",
      fixed: "right",
      width: 110,
      render: (_, row) => {
        const hasAny = Boolean(row.checkInPhotoUrl || row.checkOutPhotoUrl);
        if (!hasAny) return "-";
        return (
          <Popconfirm
            title="Delete both check-in and check-out photos?"
            okText="Delete both"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDeletePhotos(row, "both")}
          >
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={deletingId === `${row._id}-both`}
            >
              Delete
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <Card style={{ marginTop: 16 }}>
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        <div>
          <Title level={5} style={{ margin: 0 }}>
            Employee Check-in / Check-out Timesheet
          </Title>
          <Text type="secondary">
            Punch times and selfie photos. Admins can delete captured photos from this panel.
          </Text>
        </div>

        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={6}>
            <Input
              placeholder="Worker ID filter"
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              allowClear
              placeholder="Status"
              style={{ width: "100%" }}
              value={status}
              onChange={setStatus}
            >
              <Option value="checked_in">Checked in</Option>
              <Option value="checked_out">Checked out</Option>
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <RangePicker
              style={{ width: "100%" }}
              value={range}
              onChange={(v) => setRange(v || [])}
            />
          </Col>
          <Col xs={24} md={4}>
            <Button type="primary" block loading={loading} onClick={load}>
              Refresh
            </Button>
          </Col>
        </Row>

        <Table
          rowKey="_id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: "max-content" }}
          size="small"
        />
      </Space>
    </Card>
  );
}
