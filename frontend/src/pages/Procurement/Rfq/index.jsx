import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  message,
} from "antd";
import { useEffect, useState } from "react";
import { getJobs } from "@/pages/Jobs/jobApi";
import { awardRfq, createRfq, listRfqs, listSuppliers, sendRfq } from "@/api/phase1Api";

export default function RfqPage() {
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    const [rfqRes, jobRes, supRes] = await Promise.all([
      listRfqs(),
      getJobs(),
      listSuppliers(),
    ]);
    setRows(rfqRes.data?.result || []);
    setJobs(Array.isArray(jobRes) ? jobRes : jobRes?.result || []);
    setSuppliers(supRes.data?.result || []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const values = await form.validateFields();
    await createRfq({
      jobId: values.jobId,
      title: values.title,
      supplierIds: values.supplierIds,
      items: [
        {
          itemName: values.itemName,
          specification: values.specification || "",
          quantity: values.quantity || 1,
          unit: values.unit || "Nos",
        },
      ],
    });
    message.success("RFQ created");
    setOpen(false);
    load();
  };

  return (
    <div style={{ padding: 20 }}>
      <Card
        title="Request for Quotations (RFQ)"
        extra={
          <Button type="primary" onClick={() => setOpen(true)}>
            + Create RFQ
          </Button>
        }
      >
        <Table
          rowKey="_id"
          dataSource={rows}
          columns={[
            { title: "RFQ #", dataIndex: "rfqNumber" },
            {
              title: "Job",
              render: (_, r) => r.jobId?.jobId || r.jobId || "-",
            },
            { title: "Title", dataIndex: "title" },
            { title: "Status", dataIndex: "status" },
            {
              title: "Vendors",
              render: (_, r) => (r.supplierIds?.length || 0),
            },
            {
              title: "Action",
              render: (_, r) => (
                <Space>
                  <Button
                    size="small"
                    onClick={async () => {
                      await sendRfq(r._id);
                      message.success("RFQ marked as sent to vendors");
                      load();
                    }}
                  >
                    Send
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    disabled={!r.vendorQuotes?.length}
                    onClick={async () => {
                      const first = r.vendorQuotes[0];
                      await awardRfq(r._id, { vendorQuoteId: first._id });
                      message.success("Supplier awarded — PO created");
                      load();
                    }}
                  >
                    Award First Quote
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="Create RFQ" open={open} onCancel={() => setOpen(false)} onOk={create}>
        <Form form={form} layout="vertical">
          <Form.Item name="jobId" label="Job" rules={[{ required: true }]}>
            <Select
              options={jobs.map((j) => ({
                value: j._id,
                label: `${j.jobId} — ${j.customer}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="title" label="Title">
            <Input />
          </Form.Item>
          <Form.Item name="supplierIds" label="Vendors" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              options={suppliers.map((s) => ({ value: s._id, label: s.name }))}
            />
          </Form.Item>
          <Form.Item name="itemName" label="Item" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="specification" label="Specification">
            <Input />
          </Form.Item>
          <Form.Item name="quantity" label="Qty" initialValue={1}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="unit" label="Unit" initialValue="Nos">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
