import { useEffect, useState } from "react";
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  message,
  Tag,
  Timeline,
  Modal,
  Space,
  Row,
  Col,
  List,
  Typography,
} from "antd";
import {
  getCustomerProjects,
  createContactRequest,
  getCustomerContacts,
  replyContactRequest,
} from "../../../api/customerPortalApi";

const { TextArea } = Input;
const { Text } = Typography;

export default function ContactUs() {
  const [form] = Form.useForm();
  const [replyForm] = Form.useForm();
  const [projects, setProjects] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await getCustomerProjects();
      setProjects(Array.isArray(res) ? res : []);
    } catch {
      setProjects([]);
    }
  };

  const fetchContacts = async () => {
    setContactsLoading(true);
    try {
      const res = await getCustomerContacts();
      setContacts(Array.isArray(res) ? res : []);
    } catch {
      setContacts([]);
      message.error("Failed to load your contact requests");
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchContacts();
  }, []);

  const onFinish = async (values) => {
    try {
      setSubmitting(true);
      await createContactRequest(values);
      message.success("Query submitted successfully ✅");
      form.resetFields();
      await fetchContacts();
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to submit query");
    } finally {
      setSubmitting(false);
    }
  };

  const openContactModal = (contact) => {
    setSelectedContact(contact);
    setModalVisible(true);
    replyForm.resetFields();
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedContact(null);
    replyForm.resetFields();
  };

  const handleReply = async (values) => {
    if (!selectedContact) return;

    try {
      setReplyLoading(true);
      await replyContactRequest(selectedContact._id, { message: values.message });
      message.success("Reply submitted successfully");
      closeModal();
      await fetchContacts();
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to send reply");
    } finally {
      setReplyLoading(false);
    }
  };

  const renderStatusTag = (status) => {
    const color = status === "Closed" ? "green" : status === "In Progress" ? "blue" : "gold";
    return <Tag color={color}>{status}</Tag>;
  };

  const renderPriorityTag = (priority) => {
    const color = priority === "High" ? "red" : priority === "Medium" ? "orange" : "green";
    return <Tag color={color}>{priority}</Tag>;
  };

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Contact Support">
            <Form layout="vertical" form={form} onFinish={onFinish}>
              <Form.Item name="projectId" label="Select Project">
                <Select placeholder="Select your project" allowClear>
                  {projects.map((p) => (
                    <Select.Option key={p._id} value={p._id}>
                      {p.jobId} - {p.address || p.site || "Project"}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="subject" label="Subject" rules={[{ required: true }]}> 
                <Input placeholder="Enter subject" />
              </Form.Item>

              <Form.Item name="message" label="Message" rules={[{ required: true }]}> 
                <TextArea rows={4} placeholder="Describe your issue..." />
              </Form.Item>

              <Form.Item name="priority" label="Priority" initialValue="Medium">
                <Select>
                  <Select.Option value="Low">Low</Select.Option>
                  <Select.Option value="Medium">Medium</Select.Option>
                  <Select.Option value="High">High</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  Submit Request
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="Your Contact Requests"
            extra={
              <Button onClick={fetchContacts} loading={contactsLoading}>
                Refresh
              </Button>
            }
          >
            <List
              loading={contactsLoading}
              dataSource={contacts}
              locale={{ emptyText: "You have no contact requests yet." }}
              renderItem={(contact) => (
                <List.Item
                  key={contact._id}
                  actions={[
                    <Button key="view" type="link" onClick={() => openContactModal(contact)}>
                      View Thread
                    </Button>,
                    contact.status !== "Closed" ? (
                      <Button key="reply" type="primary" onClick={() => openContactModal(contact)}>
                        Reply
                      </Button>
                    ) : null,
                  ]}
                >
                  <List.Item.Meta
                    title={contact.subject}
                    description={
                      <Space wrap>
                        {renderPriorityTag(contact.priority)}
                        {renderStatusTag(contact.status)}
                        <span>{contact.projectId ? contact.projectId.jobId || contact.projectId.site || contact.projectId.address : "No project"}</span>
                      </Space>
                    }
                  />
                  <div>{contact.message}</div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={selectedContact ? `Request: ${selectedContact.subject}` : "Request details"}
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={800}
        destroyOnClose
      >
        {selectedContact && (
          <>
            <Card type="inner" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space wrap>
                  {renderStatusTag(selectedContact.status)}
                  {renderPriorityTag(selectedContact.priority)}
                  <Tag>{selectedContact.projectId ? selectedContact.projectId.jobId || selectedContact.projectId.site || selectedContact.projectId.address : "No project"}</Tag>
                </Space>
                <Text>{selectedContact.message}</Text>
              </Space>
            </Card>

            <Timeline>
              {(selectedContact.conversation || []).map((entry, index) => (
                <Timeline.Item
                  key={entry._id || index}
                  color={entry.sender === "admin" ? "blue" : "green"}
                >
                  <div style={{ marginBottom: 6 }}>
                    <Text strong>{entry.sender === "admin" ? "Support" : "You"}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {entry.userId?.name ? `${entry.userId.name} • ` : ""}
                      {new Date(entry.createdAt).toLocaleString()}
                    </Text>
                  </div>
                  <div>{entry.message}</div>
                </Timeline.Item>
              ))}
            </Timeline>

            {selectedContact.status !== "Closed" && (
              <Form form={replyForm} layout="vertical" onFinish={handleReply} style={{ marginTop: 24 }}>
                <Form.Item
                  name="message"
                  label="Send a reply"
                  rules={[{ required: true, message: "Reply message is required" }]}
                >
                  <TextArea rows={4} placeholder="Write your reply here..." />
                </Form.Item>

                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={replyLoading}>
                    Send Reply
                  </Button>
                </Form.Item>
              </Form>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
