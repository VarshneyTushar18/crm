import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  Popconfirm,
  Modal,
  Form,
  Input,
  message,
  Tag,
} from "antd";

import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "./customerApi";

export default function Customer() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form] = Form.useForm();

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const list = await getCustomers();
      setData(Array.isArray(list) ? list : []);
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const onAdd = () => {
    setEditItem(null);
    form.resetFields();
    setOpen(true);
  };

  const onEdit = (row) => {
    setEditItem(row);
    form.setFieldsValue({
      name: row?.name || "",
      companyName: row?.companyName || "",
      email: row?.email || "",
      phone: row?.phone || "",
      address: row?.address || "",
    });
    setOpen(true);
  };

  const onDelete = async (id) => {
    try {
      await deleteCustomer(id);
      message.success("Customer deleted");
      fetchCustomers();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Delete failed");
    }
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editItem?._id) {
        await updateCustomer(editItem._id, values);
        message.success("Customer updated");
      } else {
        await createCustomer(values);
        message.success("Customer created");
      }

      setOpen(false);
      form.resetFields();
      fetchCustomers();
    } catch (err) {
      // validateFields throws too; so only show API error if it exists
      if (err?.response) {
        message.error(err?.response?.data?.message || "Save failed");
      }
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      render: (v) => v || "-",
    },
    {
      title: "Company",
      dataIndex: "companyName",
      render: (v) => v || "-",
    },
    {
      title: "Email",
      dataIndex: "email",
      render: (v) => v || "-",
    },
    {
      title: "Phone",
      dataIndex: "phone",
      render: (v) => v || "-",
    },
    {
      title: "Status",
      dataIndex: "isActive",
      render: (v) => <Tag color={v === false ? "red" : "green"}>{v === false ? "Inactive" : "Active"}</Tag>,
    },
    {
      title: "Action",
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => onEdit(row)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this customer?"
            okText="Yes"
            cancelText="No"
            onConfirm={() => onDelete(row?._id)}
          >
            <Button size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Customers</h2>
        <Button type="primary" onClick={onAdd}>
          + Add Customer
        </Button>
      </div>

      <Table
        rowKey={(row) => row?._id || row?.id}
        loading={loading}
        columns={columns}
        dataSource={data}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editItem?._id ? "Edit Customer" : "Add Customer"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText={editItem?._id ? "Update" : "Create"}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="Customer name" />
          </Form.Item>

          <Form.Item
            name="companyName"
            label="Company Name"
            rules={[{ required: true, message: "Company Name is required" }]}
          >
            <Input placeholder="Company name" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Enter valid email" },
            ]}
          >
            <Input placeholder="email@company.com" />
          </Form.Item>

          <Form.Item name="phone" label="Phone">
            <Input placeholder="Phone number" />
          </Form.Item>

          <Form.Item name="address" label="Address">
            <Input.TextArea rows={3} placeholder="Address" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
