import { useEffect, useMemo, useState } from "react";
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

const uniqueColumnFilters = (items, getValue) => {
  const values = [...new Set(items.map(getValue).filter(Boolean))].sort();
  return values.map((v) => ({ text: String(v), value: v }));
};

const textColumnFilter = (placeholder, getSearchText) => ({
  filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
    <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
      <Input
        placeholder={placeholder}
        value={selectedKeys[0]}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={() => confirm()}
        style={{ marginBottom: 8, display: "block" }}
        allowClear
      />
      <Space>
        <Button type="primary" onClick={() => confirm()} size="small">
          Search
        </Button>
        <Button
          onClick={() => {
            clearFilters?.();
            confirm();
          }}
          size="small"
        >
          Reset
        </Button>
      </Space>
    </div>
  ),
  onFilter: (value, record) => {
    const hay = String(getSearchText(record) || "").toLowerCase();
    return hay.includes(String(value).toLowerCase());
  },
});

const formatCheckIn = (v) => (v ? dayjs(v).format("DD MMM YYYY HH:mm:ss") : "-");
const formatCheckOut = (v) => (v ? dayjs(v).format("DD MMM YYYY HH:mm:ss") : "—");

const gpsText = (row) =>
  row.checkInLatitude != null
    ? `${Number(row.checkInLatitude).toFixed(4)}, ${Number(row.checkInLongitude).toFixed(4)}`
    : "-";

const hoursDisplay = (row) =>
  row.status === "checked_in" ? "On shift" : formatMinutes(row.totalMinutes);

const livenessDisplay = (row) => (row.livenessPassed ? `Passed ${row.livenessScore || 0}%` : "N/A");

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

  const workerIdFilters = useMemo(
    () => uniqueColumnFilters(rows, (r) => r.workerId),
    [rows]
  );

  const employeeNameFilters = useMemo(
    () => uniqueColumnFilters(rows, (r) => r.workerName),
    [rows]
  );

  const hoursFilters = useMemo(() => {
    const values = new Set();
    rows.forEach((r) => values.add(hoursDisplay(r)));
    return [...values].sort().map((v) => ({ text: v, value: v }));
  }, [rows]);

  const livenessFilters = useMemo(() => {
    const values = new Set(rows.map((r) => livenessDisplay(r)));
    return [...values].sort().map((v) => ({ text: v, value: v }));
  }, [rows]);

  const statusFilters = useMemo(
    () => [
      { text: "Checked in", value: "checked_in" },
      { text: "Checked out", value: "checked_out" },
    ],
    []
  );

  const columns = useMemo(
    () => [
    {
      title: "Employee ID",
      dataIndex: "workerId",
      width: 110,
      filters: workerIdFilters,
      onFilter: (value, record) => record.workerId === value,
      render: (v) => v || "-",
    },
    {
      title: "Employee",
      dataIndex: "workerName",
      filters: employeeNameFilters,
      onFilter: (value, record) => record.workerName === value,
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.workerName || "-"}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.workerEmail || "-"}
          </Text>
        </div>
      ),
    },
    {
      title: "Check-in",
      dataIndex: "checkInTime",
      render: (v) => formatCheckIn(v),
    },
    {
      title: "Check-out",
      dataIndex: "checkOutTime",
      render: (v) => formatCheckOut(v),
    },
    {
      title: "Hours",
      filters: hoursFilters,
      onFilter: (value, record) => hoursDisplay(record) === value,
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
      ...textColumnFilter("Search coordinates", gpsText),
      render: (_, row) => gpsText(row),
    },
    {
      title: "Liveness",
      filters: livenessFilters,
      onFilter: (value, record) => livenessDisplay(record) === value,
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
      filters: statusFilters,
      onFilter: (value, record) => record.status === value,
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
  ],
    [
      deletingId,
      employeeNameFilters,
      hoursFilters,
      livenessFilters,
      statusFilters,
      workerIdFilters,
    ]
  );

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
