import { Button, Card, Form, Input, Modal, Popconfirm, Space, Table, message } from "antd";
import { useEffect, useState } from "react";
import { createSite, deleteSite, listSites, updateSite } from "@/api/phase1Api";

export default function Sites() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    const res = await listSites();
    setRows(res.data?.result || []);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const values = await form.validateFields();
    if (editing) await updateSite(editing._id, values);
    else await createSite(values);
    message.success("Site saved");
    setOpen(false);
    load();
  };

  return (
    <div style={{ padding: 20 }}>
      <Card
        title="Sites / Locations"
        extra={
          <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
            + Add Site
          </Button>
        }
      >
        <Table
          rowKey="_id"
          dataSource={rows}
          columns={[
            { title: "Name", dataIndex: "name" },
            { title: "Code", dataIndex: "code" },
            { title: "City", dataIndex: "city" },
            { title: "Address", dataIndex: "address" },
            {
              title: "Action",
              render: (_, r) => (
                <Space>
                  <Button type="link" onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }}>
                    Edit
                  </Button>
                  <Popconfirm title="Delete?" onConfirm={async () => { await deleteSite(r._id); load(); }}>
                    <Button type="link" danger>Delete</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Modal title="Site" open={open} onCancel={() => setOpen(false)} onOk={save}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="Code"><Input /></Form.Item>
          <Form.Item name="city" label="City"><Input /></Form.Item>
          <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
