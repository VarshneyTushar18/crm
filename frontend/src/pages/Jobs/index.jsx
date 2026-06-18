import { useEffect, useMemo, useState } from "react";
import { Table, Button, Space, Popconfirm, message, Select, Tag } from "antd";
import JobForm from "./JobForm";
import { getJobs, createJob, deleteJob, updateJob } from "./jobApi";
import { useNavigate } from "react-router-dom";
import { useJob } from "../../context/JobContext";

const { Option } = Select;

const SYSTEM_STATES = ["New", "Active", "Completed", "Closed"];

const STATE_COLORS = {
  New: "blue",
  Active: "orange",
  Completed: "green",
  Closed: "default",
};



export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const [stateFilter, setStateFilter] = useState("All");

  const { setActiveJobId } = useJob();
  const navigate = useNavigate();



  const fetchJobs = async () => {
    setLoading(true);
    try {
      const data = await getJobs();
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to fetch jobs"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);



  const setJobContext = (job) => {
    const jobObjectId = job?._id;

    if (!jobObjectId) {
      message.error("Job id missing");
      return false;
    }

    setActiveJobId(jobObjectId);
    localStorage.setItem("activeJobId", jobObjectId);
    localStorage.setItem(`activeJobData_${jobObjectId}`, JSON.stringify(job));
    localStorage.setItem("activeJobData", JSON.stringify(job));
    return true;
  };

  const openJob = (job, route) => {
    const ok = setJobContext(job);
    if (!ok) return;
    navigate(route, { state: { job } });
  };

  const handleDelete = async (id) => {
    try {
      await deleteJob(id);
      message.success("Job archived");
      await fetchJobs();
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Failed to archive job"
      );
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      return stateFilter === "All" || j.systemState === stateFilter;
    });
  }, [jobs, stateFilter]);

  const columns = [
    {
      title: "Job ID",
      dataIndex: "jobId",
      width: 150,
    },
    {
      title: "Customer",
      dataIndex: "customer",
      render: (v) => v || "-",
      width: 180,
    },
    {
      title: "Site",
      dataIndex: "site",
      render: (v) => v || "-",
      width: 220,
    },
    {
      title: "State",
      dataIndex: "systemState",
      width: 150,
      render: (v) => <Tag color={STATE_COLORS[v] || "default"}>{v || "New"}</Tag>,
    },
    {
      title: "Value",
      dataIndex: "lockedValue",
      width: 150,
      render: (v) => v ? `$${v.toFixed(2)}` : "-",
    },
    {
      title: "Actions",
      width: 200,
      render: (_, record) => {
        return (
          <Space>
            <Button type="primary" size="small" onClick={() => navigate(`/admin/job/${record._id}`)}>
              View Timeline
            </Button>
            <Popconfirm title="Archive/Delete Job?" onConfirm={() => handleDelete(record._id)}>
              <Button danger size="small">
                Archive
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-shell">
      <h2 className="page-shell__title">Jobs Management</h2>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 15,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Select
          value={stateFilter}
          style={{ width: 170 }}
          onChange={setStateFilter}
        >
          <Option value="All">All States</Option>
          {SYSTEM_STATES.map((s) => (
            <Option key={s} value={s}>
              <Tag color={STATE_COLORS[s]}>{s}</Tag>
            </Option>
          ))}
        </Select>

        <Button
          onClick={() => {
            setStateFilter("All");
          }}
        >
          Reset
        </Button>
      </div>

      <div className="table-responsive-wrap">
      <Table
        columns={columns}
        dataSource={filteredJobs}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: "max-content" }}
      />
      </div>
    </div>
  );
}