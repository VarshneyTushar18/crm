import { Button, Card, Form, Input, Modal, Popconfirm, Space, Table, message } from "antd";
import { useEffect, useState } from "react";
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
} from "@/api/phase1Api";

export default function Suppliers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await listSuppliers();
      setRows(res.data?.result || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openModal = (record = null) => {
    setEditing(record);
    form.setFieldsValue(record || { isActive: true });
    setOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateSupplier(editing._id, values);
      message.success("Supplier updated");
    } else {
      await createSupplier(values);
      message.success("Supplier created");
    }
    setOpen(false);
    load();
  };

  return (
    <div style={{ padding: 20 }}>
      <Card
        title="Suppliers"
        extra={
          <Button type="primary" onClick={() => openModal()}>
            + Add Supplier
          </Button>
        }
      >
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={rows}
          columns={[
            { title: "Name", dataIndex: "name" },
            { title: "Contact", dataIndex: "contactPerson" },
            { title: "Email", dataIndex: "email" },
            { title: "Phone", dataIndex: "phone" },
            { title: "Address", dataIndex: "address" },
            {
              title: "Action",
              render: (_, r) => (
                <Space>
                  <Button type="link" onClick={() => openModal(r)}>
                    Edit
                  </Button>
                  <Popconfirm title="Delete?" onConfirm={async () => {
                    await deleteSupplier(r._id);
                    load();
                  }}>
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
        title={editing ? "Edit Supplier" : "Add Supplier"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contactPerson" label="Contact Person">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
