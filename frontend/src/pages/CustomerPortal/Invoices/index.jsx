import { useEffect, useState } from "react";
import { Card, Table, Tag, Button, Modal, Form, Input, DatePicker, Select, message, Space, Typography } from "antd";
import { DollarOutlined, InfoCircleOutlined, CheckCircleOutlined, SyncOutlined } from "@ant-design/icons";
import { customerGetInvoices, customerNotifyPayment } from "../customerApi";
import dayjs from "dayjs";

const { Text } = Typography;

export default function CustomerInvoices() {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [form] = Form.useForm();

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await customerGetInvoices();
      setInvoices(res);
    } catch (err) {
      message.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleNotifyPayment = async (values) => {
    try {
      setLoading(true);
      await customerNotifyPayment(selectedInvoice._id, {
        ...values,
        date: values.date.toDate(),
      });
      message.success("Payment notification sent to Admin for verification");
      setIsModalOpen(false);
      fetchInvoices();
    } catch (err) {
      message.error("Failed to send notification");
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case "Paid": return "success";
      case "Partially Paid": return "warning";
      case "Overdue": return "error";
      case "Issued": return "processing";
      default: return "default";
    }
  };

  const columns = [
    { title: "Invoice #", dataIndex: "number", key: "number" },
    { title: "Date", dataIndex: "date", key: "date", render: (d) => dayjs(d).format("DD MMM YYYY") },
    { title: "Due Date", dataIndex: "expiredDate", key: "expiredDate", render: (d) => dayjs(d).format("DD MMM YYYY") },
    { title: "Total", dataIndex: "total", key: "total", render: (v) => `$${v.toLocaleString()}` },
    { title: "Balance Due", dataIndex: "amountDue", key: "amountDue", render: (v) => <Text type={v > 0 ? "danger" : "secondary"}>${v.toLocaleString()}</Text> },
    { 
      title: "Status", 
      dataIndex: "status", 
      key: "status",
      render: (status, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={statusColor(status)}>{status}</Tag>
          {record.paymentNotified && (
            <Tag color="cyan" icon={<SyncOutlined spin />} style={{ marginTop: 4 }}>
              Payment Pending Verification
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => {
        if (record.status === "Paid") return <Tag color="success">Fully Paid</Tag>;
        if (record.paymentNotified) return <Text type="secondary">Admin is verifying...</Text>;
        
        return (
          <Button 
            type="primary" 
            size="small" 
            icon={<DollarOutlined />}
            onClick={() => {
              setSelectedInvoice(record);
              setIsModalOpen(true);
            }}
          >
            Mark as Paid
          </Button>
        );
      }
    }
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card title="My Invoices" bordered={false} style={{ borderRadius: 16 }}>
        <Table 
          rowKey="_id"
          columns={columns} 
          dataSource={invoices} 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={`Notify Payment for Invoice ${selectedInvoice?.number}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" onFinish={handleNotifyPayment} initialValues={{ date: dayjs(), paymentMode: 'Bank Transfer' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Use this form to notify the admin that you have made a payment. Once verified, your invoice status will be updated.
          </Text>
          
          <Form.Item name="date" label="Payment Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="paymentMode" label="Payment Mode" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="Bank Transfer">Bank Transfer</Select.Option>
              <Select.Option value="Check">Check</Select.Option>
              <Select.Option value="Cash">Cash</Select.Option>
              <Select.Option value="Credit Card">Credit Card</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="paymentRef" label="Reference ID / Transaction ID" rules={[{ required: true, message: 'Please provide a reference ID so we can verify the payment' }]}>
            <Input placeholder="e.g. TXN-12345678" />
          </Form.Item>

          <Form.Item name="amount" label="Amount Paid" initialValue={selectedInvoice?.amountDue}>
            <Input prefix="$" disabled />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
