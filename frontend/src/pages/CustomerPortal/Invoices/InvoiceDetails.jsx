import { useEffect, useState } from "react";
import { Button, Card, Space, message, Spin } from "antd";
import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { customerGetInvoiceById } from "../customerApi";
import CustomerInvoiceTemplate from "./CustomerInvoiceTemplate";

export default function CustomerInvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await customerGetInvoiceById(id);
        setData(res || null);
      } catch (err) {
        message.error(err?.response?.data?.message || "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data?.invoice) {
    return (
      <Card>
        <p>Invoice not found.</p>
        <Button onClick={() => navigate("/portal/invoices")}>Back to Invoices</Button>
      </Card>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <Space className="no-print" style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/portal/invoices")}>
          Back to Invoices
        </Button>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </Space>

      <Card bordered={false} style={{ borderRadius: 16 }} bodyStyle={{ padding: 24 }}>
        <CustomerInvoiceTemplate data={data} />
      </Card>
    </div>
  );
}
