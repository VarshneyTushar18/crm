import { useEffect, useState } from "react";
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Row,
  Col,
  Divider,
  message,
  Spin,
} from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { customerGetQuoteById } from "../customerApi";
import dayjs from "dayjs";

const statusColor = (status) => {
  switch (status) {
    case "Accepted":
      return "success";
    case "Sent":
      return "processing";
    case "Rejected":
      return "error";
    default:
      return "default";
  }
};

export default function CustomerQuoteDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    const fetchQuote = async () => {
      setLoading(true);
      try {
        const res = await customerGetQuoteById(id);
        setQuote(res || null);
      } catch (err) {
        message.error(
          err?.response?.data?.message || err?.message || "Failed to load quote"
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchQuote();
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!quote) {
    return (
      <Card>
        <p>Quote not found.</p>
        <Button onClick={() => navigate("/portal/quotes")}>Back to Quotes</Button>
      </Card>
    );
  }

  return (
    <div>
      <Button style={{ marginBottom: 12 }} onClick={() => navigate("/portal/quotes")}>
        Back to Quotes
      </Button>

      <Card
        title={
          <span>
            Quote {quote.quoteNumber || ""}{" "}
            <Tag color={statusColor(quote.status)}>{quote.status}</Tag>
          </span>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Project ID">
                {quote.jobCode || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {quote.customerName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Contact Person">
                {quote.contactPerson || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Site Address">
                {quote.siteAddress || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                {quote.categoryCode || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Material">
                {quote.materialCode || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount">
                ₹{" "}
                {Number(quote.totalAmount || 0).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </Descriptions.Item>
              <Descriptions.Item label="Valid Until">
                {quote.validUntil
                  ? dayjs(quote.validUntil).format("DD MMM YYYY")
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Approved On">
                {quote.approvedAt
                  ? dayjs(quote.approvedAt).format("DD MMM YYYY")
                  : "—"}
              </Descriptions.Item>
            </Descriptions>
          </Col>

          <Col xs={24} lg={12}>
            <Card type="inner" title="Scope" size="small">
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{quote.scope || "—"}</p>
            </Card>
            <Divider style={{ margin: "12px 0" }} />
            <Card type="inner" title="Inclusions" size="small">
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {quote.inclusions || "—"}
              </p>
            </Card>
            <Divider style={{ margin: "12px 0" }} />
            <Card type="inner" title="Exclusions" size="small">
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {quote.exclusions || "—"}
              </p>
            </Card>
            {quote.assumptions ? (
              <>
                <Divider style={{ margin: "12px 0" }} />
                <Card type="inner" title="Assumptions" size="small">
                  <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{quote.assumptions}</p>
                </Card>
              </>
            ) : null}
          </Col>
        </Row>
      </Card>
    </div>
  );
}
