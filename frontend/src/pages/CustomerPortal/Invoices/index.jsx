import { useEffect, useState } from "react";
import { Card, Table, Tag, Button, Modal, Form, Input, DatePicker, Select, message, Space, Typography } from "antd";
import { DollarOutlined, EyeOutlined, SyncOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  customerGetInvoices,
  customerGetPaymentModes,
  customerNotifyPayment,
} from "../customerApi";
import dayjs from "dayjs";

const { Text } = Typography;

export default function CustomerInvoices() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
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

  const fetchPaymentModes = async () => {
    try {
      const modes = await customerGetPaymentModes();
      setPaymentModes(modes || []);
      const defaultMode =
        modes.find((mode) => mode.isDefault) ||
        modes.find((mode) => mode.name === "Bank Transfer") ||
        modes[0];
      if (defaultMode?.name) {
        form.setFieldsValue({ paymentMode: defaultMode.name });
      }
    } catch (err) {
      // Keep Mark as Paid usable even if modes fail to load
      setPaymentModes([
        { name: "Bank Transfer", isDefault: true },
        { name: "Cheque" },
        { name: "Cash" },
        { name: "Credit Card" },
      ]);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchPaymentModes();
  }, []);

  const openMarkAsPaid = (record) => {
    setSelectedInvoice(record);
    const defaultMode =
      paymentModes.find((mode) => mode.isDefault) ||
      paymentModes.find((mode) => mode.name === "Bank Transfer") ||
      paymentModes[0];
    form.setFieldsValue({
      date: dayjs(),
      paymentMode: defaultMode?.name || "Bank Transfer",
      paymentRef: undefined,
      amount: record?.amountDue,
    });
    setIsModalOpen(true);
  };

  const handleNotifyPayment = async (values) => {
    try {
      setLoading(true);
      // Keep claim payload as string mode name — matches Invoice.paymentMode String field
      await customerNotifyPayment(selectedInvoice._id, {
        paymentRef: values.paymentRef,
        paymentMode: values.paymentMode,
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
      render: (_, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/portal/invoices/${record._id}`)}
          >
            View
          </Button>
          {record.status === "Paid" ? (
            <Tag color="success">Fully Paid</Tag>
          ) : record.paymentNotified ? (
            <Text type="secondary">Admin is verifying...</Text>
          ) : (
            <Button
              type="primary"
              size="small"
              icon={<DollarOutlined />}
              onClick={() => openMarkAsPaid(record)}
            >
              Mark as Paid
            </Button>
          )}
        </Space>
      ),
    },
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
        <Form form={form} layout="vertical" onFinish={handleNotifyPayment}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Use this form to notify the admin that you have made a payment. Once verified, your invoice status will be updated.
          </Text>
          
          <Form.Item name="date" label="Payment Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="paymentMode" label="Payment Mode" rules={[{ required: true, message: "Please select payment mode" }]}>
            <Select placeholder="Select payment mode">
              {paymentModes.map((mode) => (
                <Select.Option key={mode._id || mode.name} value={mode.name}>
                  {mode.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="paymentRef" label="Reference ID / Transaction ID" rules={[{ required: true, message: 'Please provide a reference ID so we can verify the payment' }]}>
            <Input placeholder="e.g. TXN-12345678" />
          </Form.Item>

          <Form.Item name="amount" label="Amount Paid">
            <Input prefix="$" disabled />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
