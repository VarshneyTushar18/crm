import { useEffect, useState } from "react";
import { Card, Table, Tag, Typography, Statistic, Row, Col, message } from "antd";
import { DollarOutlined, CreditCardOutlined } from "@ant-design/icons";
import { customerGetPaymentSummary } from "../customerApi";
import dayjs from "dayjs";

const { Text } = Typography;

export default function CustomerPayments() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ count: 0, total: 0, items: [] });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await customerGetPaymentSummary();
      setSummary({
        count: res?.count ?? 0,
        total: res?.total ?? 0,
        items: Array.isArray(res?.items) ? res.items : [],
      });
    } catch (err) {
      message.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (d) => (d ? dayjs(d).format("DD MMM YYYY") : "—"),
    },
    {
      title: "Reference",
      dataIndex: "ref",
      key: "ref",
      render: (v) => v || "—",
    },
    {
      title: "Invoice",
      key: "invoice",
      render: (_, row) => row?.invoice?.number || "—",
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (v) => v || "—",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (v) => <Text strong>${Number(v || 0).toLocaleString()}</Text>,
    },
    {
      title: "Invoice Status",
      key: "invoiceStatus",
      render: (_, row) => {
        const status = row?.invoice?.status;
        if (!status) return "—";
        const color =
          status === "Paid" ? "success" : status === "Partially Paid" ? "warning" : "default";
        return <Tag color={color}>{status}</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}>
          <Card bordered={false} style={{ borderRadius: 16 }}>
            <Statistic
              title="Total Paid"
              value={summary.total}
              prefix={<DollarOutlined />}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card bordered={false} style={{ borderRadius: 16 }}>
            <Statistic
              title="Payment Records"
              value={summary.count}
              prefix={<CreditCardOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Payment History" bordered={false} style={{ borderRadius: 16 }}>
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={summary.items}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
