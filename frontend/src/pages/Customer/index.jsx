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
  Typography,
  Alert,
  Tabs,
  Select,
  Switch,
  Card,
} from "antd";

import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createCustomerPortalLogin,
  resetCustomerPortalPassword,
} from "./customerApi";

const { Text } = Typography;

export default function Customer() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form] = Form.useForm();

  const [portalModalOpen, setPortalModalOpen] = useState(false);
  const [portalCustomer, setPortalCustomer] = useState(null);
  const [portalMode, setPortalMode] = useState("create");
  const [portalForm] = Form.useForm();
  const [portalSaving, setPortalSaving] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);

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
      addresses: row?.addresses?.length ? row.addresses : [],
      contacts: row?.contacts?.length ? row.contacts : [],
      phones: row?.phones?.length ? row.phones : [],
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
      if (err?.response) {
        message.error(err?.response?.data?.message || "Save failed");
      }
    }
  };

  const openPortalModal = (row, mode) => {
    setPortalCustomer(row);
    setPortalMode(mode);
    setGeneratedCredentials(null);
    portalForm.resetFields();
    setPortalModalOpen(true);
  };

  const closePortalModal = () => {
    setPortalModalOpen(false);
    setPortalCustomer(null);
    setGeneratedCredentials(null);
    portalForm.resetFields();
  };

  const handlePortalSubmit = async () => {
    if (!portalCustomer?._id) return;

    try {
      const values = await portalForm.validateFields();
      setPortalSaving(true);

      const res =
        portalMode === "create"
          ? await createCustomerPortalLogin(portalCustomer._id, values.password)
          : await resetCustomerPortalPassword(portalCustomer._id, values.password);

      if (res?.success === false) {
        throw new Error(res?.message || "Portal login action failed");
      }

      setGeneratedCredentials({
        email: res?.result?.portalLoginEmail || portalCustomer.email,
        password: res?.result?.password,
        message: res?.message,
      });

      message.success(res?.message || "Portal login updated");
      await fetchCustomers();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Portal login failed");
    } finally {
      setPortalSaving(false);
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
      title: "Portal Login",
      key: "portalLogin",
      render: (_, row) =>
        row?.hasPortalLogin ? (
          <Tag color="green">Active</Tag>
        ) : (
          <Tag color="orange">Not Created</Tag>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (v) => (
        <Tag color={v === "Completed" ? "default" : "green"}>
          {v || "Active"}
        </Tag>
      ),
    },
    {
      title: "Action",
      width: 280,
      render: (_, row) => (
        <Space wrap>
          <Button size="small" onClick={() => onEdit(row)}>
            Edit
          </Button>
          {!row?.hasPortalLogin ? (
            <Button
              size="small"
              type="primary"
              onClick={() => openPortalModal(row, "create")}
            >
              Create Login
            </Button>
          ) : (
            <Button size="small" onClick={() => openPortalModal(row, "reset")}>
              Reset Password
            </Button>
          )}
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
    <div className="page-shell">
      <div className="page-shell__header">
        <h2 className="page-shell__title">Customers</h2>
        <Button type="primary" onClick={onAdd}>
          + Add Customer
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Portal passwords are not stored on this page. Use Create Login or Reset Password to generate credentials for /portal/login."
      />

      <div className="table-responsive-wrap">
        <Table
          rowKey={(row) => row?._id || row?.id}
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 10 }}
          scroll={{ x: "max-content" }}
        />
      </div>

      <Modal
        title={editItem?._id ? "Edit Customer" : "Add Customer"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText={editItem?._id ? "Update" : "Create"}
        width={720}
      >
        <Form form={form} layout="vertical">
          <Tabs
            items={[
              {
                key: "basic",
                label: "Basic Info",
                children: (
                  <>
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

                    <Form.Item name="address" label="Primary Address (legacy)">
                      <Input.TextArea rows={3} placeholder="Address" />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: "addresses",
                label: "Addresses",
                children: (
                  <Form.List name="addresses">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...rest }) => (
                          <Card
                            key={key}
                            size="small"
                            style={{ marginBottom: 12 }}
                            extra={<Button danger size="small" onClick={() => remove(name)}>Remove</Button>}
                          >
                            <Form.Item {...rest} name={[name, "type"]} label="Type">
                              <Select
                                options={[
                                  { value: "Billing", label: "Billing" },
                                  { value: "Site", label: "Site" },
                                  { value: "Office", label: "Office" },
                                  { value: "Other", label: "Other" },
                                ]}
                              />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, "line1"]} label="Line 1">
                              <Input />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, "line2"]} label="Line 2">
                              <Input />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, "city"]} label="City">
                              <Input />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, "isPrimary"]} label="Primary" valuePropName="checked">
                              <Switch />
                            </Form.Item>
                          </Card>
                        ))}
                        <Button type="dashed" onClick={() => add({ type: "Site", isPrimary: false })} block>
                          + Add Address
                        </Button>
                      </>
                    )}
                  </Form.List>
                ),
              },
              {
                key: "contacts",
                label: "Contacts",
                children: (
                  <Form.List name="contacts">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...rest }) => (
                          <Card
                            key={key}
                            size="small"
                            style={{ marginBottom: 12 }}
                            extra={<Button danger size="small" onClick={() => remove(name)}>Remove</Button>}
                          >
                            <Form.Item {...rest} name={[name, "name"]} label="Name">
                              <Input />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, "role"]} label="Role">
                              <Input />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, "email"]} label="Email">
                              <Input />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, "phone"]} label="Phone">
                              <Input />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, "isPrimary"]} label="Primary" valuePropName="checked">
                              <Switch />
                            </Form.Item>
                          </Card>
                        ))}
                        <Button type="dashed" onClick={() => add({ isPrimary: false })} block>
                          + Add Contact
                        </Button>
                      </>
                    )}
                  </Form.List>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      <Modal
        title={
          portalMode === "create"
            ? `Create Portal Login — ${portalCustomer?.name || ""}`
            : `Reset Portal Password — ${portalCustomer?.name || ""}`
        }
        open={portalModalOpen}
        onCancel={closePortalModal}
        onOk={generatedCredentials ? closePortalModal : handlePortalSubmit}
        okText={generatedCredentials ? "Done" : portalMode === "create" ? "Create Login" : "Reset Password"}
        confirmLoading={portalSaving}
      >
        {generatedCredentials ? (
          <div>
            <Alert
              type="success"
              showIcon
              message={generatedCredentials.message || "Portal credentials ready"}
              style={{ marginBottom: 16 }}
            />
            <p>
              <Text strong>Login URL:</Text>{" "}
              <Text copyable>/portal/login</Text>
            </p>
            <p>
              <Text strong>Email:</Text>{" "}
              <Text copyable>{generatedCredentials.email}</Text>
            </p>
            <p>
              <Text strong>Password:</Text>{" "}
              <Text copyable>{generatedCredentials.password}</Text>
            </p>
            <Text type="secondary">
              Share these credentials with the customer. Passwords are hashed in the database and cannot be viewed again later.
            </Text>
          </div>
        ) : (
          <Form form={portalForm} layout="vertical">
            <Form.Item label="Portal Email">
              <Input
                readOnly
                value={portalCustomer?.portalLoginEmail || portalCustomer?.email || ""}
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password (optional)"
              extra="Leave blank to auto-generate a secure password."
              rules={[
                {
                  validator: (_, value) => {
                    if (!value || String(value).length >= 6) return Promise.resolve();
                    return Promise.reject(new Error("Password must be at least 6 characters"));
                  },
                },
              ]}
            >
              <Input.Password placeholder="Auto-generate if empty" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
