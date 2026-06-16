import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Typography,
} from "antd";
import axiosClient from "../../../api/axiosClient";

const { Text } = Typography;
const { TextArea } = Input;

const statusOptions = ["Open", "In Progress", "Closed"];

export default function ContactRequests() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [form] = Form.useForm();

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get("/api/contact/list");
      setContacts(res.data?.result || []);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load contact requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const showRespondModal = (contact) => {
    setSelectedContact(contact);
    form.setFieldsValue({
      status: contact.status || "Open",
      response: contact.response || "",
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedContact(null);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    if (!selectedContact) return;

    try {
      setLoading(true);
      await axiosClient.patch(`/api/contact/${selectedContact._id}/respond`, values);
      message.success("Response saved successfully");
      closeModal();
      await fetchContacts();
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to save response");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Customer",
      dataIndex: ["customerId", "name"],
      key: "customer",
      render: (_, record) => record.customerId?.name || "-",
    },
    {
      title: "Email",
      dataIndex: ["customerId", "email"],
      key: "email",
      render: (_, record) => record.customerId?.email || "-",
    },
    {
      title: "Project",
      dataIndex: ["projectId", "jobId"],
      key: "project",
      render: (_, record) => record.projectId?.jobId || "-",
    },
    {
      title: "Subject",
      dataIndex: "subject",
      key: "subject",
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (value) => {
        const color = value === "High" ? "red" : value === "Medium" ? "orange" : "green";
        return <Tag color={color}>{value || "Medium"}</Tag>;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value) => {
        const color = value === "Closed" ? "green" : value === "In Progress" ? "blue" : "gold";
        return <Tag color={color}>{value}</Tag>;
      },
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (value) => (value ? new Date(value).toLocaleString() : "-"),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button type="primary" onClick={() => showRespondModal(record)}>
          Respond
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="Customer Contact Requests"
        extra={<Button onClick={fetchContacts}>Refresh</Button>}
      >
        <Table
          rowKey={(record) => record._id}
          dataSource={contacts}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Card>

      <Modal
        title={selectedContact ? "Respond to Contact Request" : "Respond"}
        open={modalVisible}
        onCancel={closeModal}
        okText="Save"
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Customer" name="customer">
            <Text>{selectedContact?.customerId?.name || "-"}</Text>
          </Form.Item>
          <Form.Item label="Subject">
            <Text>{selectedContact?.subject || "-"}</Text>
          </Form.Item>
          <Form.Item label="Original Message">
            <Text>{selectedContact?.message || "-"}</Text>
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: "Status is required" }]}
          >
            <Select>
              {statusOptions.map((item) => (
                <Select.Option key={item} value={item}>
                  {item}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Response" name="response">
            <TextArea rows={4} placeholder="Write your response to the customer" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
