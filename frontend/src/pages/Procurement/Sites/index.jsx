import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { createSite, deleteSite, listSites, updateSite } from "@/api/phase1Api";
import { getJobs } from "@/pages/Jobs/jobApi";

export default function Sites() {
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [sitesRes, jobList] = await Promise.all([listSites(), getJobs()]);
      setRows(sitesRes.data?.result || []);
      setJobs(Array.isArray(jobList) ? jobList : []);
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Failed to load sites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openModal = (record = null) => {
    setEditing(record);
    form.setFieldsValue(
      record
        ? {
            name: record.name,
            code: record.code,
            city: record.city,
            address: record.address,
            jobId: record.jobMongoId || record.jobs?.[0]?._id,
          }
        : { name: "", code: "", city: "", address: "", jobId: undefined }
    );
    setOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateSite(editing._id, values);
        message.success("Site updated");
      } else {
        await createSite(values);
        message.success("Site saved and linked to job");
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Failed to save site");
    }
  };

  const jobOptions = jobs.map((j) => ({
    value: j._id,
    label: `${j.jobId || "Job"}${j.customer ? ` — ${j.customer}` : ""}${
      j.site ? ` (${j.site})` : ""
    }`,
  }));

  return (
    <div style={{ padding: 20 }}>
      <Card
        title="Sites / Locations"
        extra={
          <Button type="primary" onClick={() => openModal()}>
            + Add Site
          </Button>
        }
      >
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={rows}
          columns={[
            { title: "Name", dataIndex: "name" },
            { title: "Code", dataIndex: "code" },
            { title: "City", dataIndex: "city" },
            { title: "Address", dataIndex: "address" },
            {
              title: "Job ID",
              dataIndex: "jobId",
              render: (v, r) =>
                v ? (
                  <Tag color="blue">{v}</Tag>
                ) : r.jobs?.length ? (
                  r.jobs.map((j) => (
                    <Tag key={j._id} color="blue">
                      {j.jobId}
                    </Tag>
                  ))
                ) : (
                  "—"
                ),
            },
            {
              title: "Customer",
              dataIndex: "customer",
              render: (v) => v || "—",
            },
            {
              title: "Action",
              render: (_, r) => (
                <Space>
                  <Button type="link" onClick={() => openModal(r)}>
                    Edit
                  </Button>
                  <Popconfirm
                    title="Delete?"
                    onConfirm={async () => {
                      await deleteSite(r._id);
                      load();
                    }}
                  >
                    <Button type="link" danger>
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title={editing ? "Edit Site" : "Add Site"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="jobId"
            label="Job"
            rules={[{ required: true, message: "Job is required" }]}
          >
            <Select
              showSearch
              placeholder="Select job"
              optionFilterProp="label"
              options={jobOptions}
            />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="Code">
            <Input />
          </Form.Item>
          <Form.Item name="city" label="City">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
