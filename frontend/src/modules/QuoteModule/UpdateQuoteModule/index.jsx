import React, { useEffect, useMemo, useState } from "react";
import { Card, Form, message, Alert, Button, Space } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../../../config/serverApiConfig";

import QuoteForm from "../Forms/QuoteForm";

const API = `${API_BASE_URL}/quote`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function UpdateQuoteModule({ config }) {
  const [form] = Form.useForm();
  const { id } = useParams();
  const navigate = useNavigate();

  const safeConfig = useMemo(
    () =>
      config || {
        entity: "quote",
      },
    [config]
  );

  const [loading, setLoading] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [currentQuote, setCurrentQuote] = useState(null);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        setLoadingQuote(true);

        const res = await axios.get(`${API}/read/${id}`, {
          headers: { ...authHeaders() },
        });

        const quote = res.data?.result || null;

        if (quote) {
          setCurrentQuote({
            ...quote,
            leadId:
              typeof quote.leadId === "object" ? quote.leadId?._id : quote.leadId,
          });
        } else {
          setCurrentQuote(null);
        }
      } catch (err) {
        message.error(
          err?.response?.data?.message || err?.message || "Failed to load quote"
        );
      } finally {
        setLoadingQuote(false);
      }
    };

    if (id) fetchQuote();
  }, [id]);

  const isLocked = currentQuote?.status === "Accepted" || currentQuote?.status === "Converted to Job";

  const onSubmit = async (values) => {
    try {
      if (isLocked) {
        message.warning("Converted quote cannot be edited.");
        return;
      }

      setLoading(true);

      const payload = {
        ...values,
        leadId:
          typeof values.leadId === "object" ? values.leadId?._id : values.leadId,
      };

      const res = await axios.patch(`${API}/update/${id}`, payload, {
        headers: { ...authHeaders() },
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Update failed");
      }

      message.success(res.data?.message || "Quote updated");
      navigate(`/admin/quote/read/${id}`);
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.message || "Update failed"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingQuote) {
    return (
      <Card title="Edit Quote" style={{ margin: 12 }}>
        Loading...
      </Card>
    );
  }

  if (!currentQuote) {
    return (
      <Card title="Edit Quote" style={{ margin: 12 }}>
        <Alert type="error" showIcon message="Quote not found" />
      </Card>
    );
  }

  return (
    <Card
      title={`Edit Quote (${currentQuote.quoteNumber || ""})`}
      style={{ margin: 12 }}
      extra={
        <Space>
          <Button onClick={() => navigate(`/admin/quote/read/${id}`)}>Back</Button>
        </Space>
      }
    >
      {isLocked && (
        <Alert
          type="info"
          showIcon
          message="This quote is Accepted and locked from further edits."
          style={{ marginBottom: 12 }}
        />
      )}

      {currentQuote.revisions?.length > 0 && (
        <Alert
          type="success"
          showIcon
          message={`This quote has ${currentQuote.revisions.length} previous versions.`}
          style={{ marginBottom: 12 }}
          action={
            <Button size="small" type="text">
              Current Version: v{currentQuote.version || 1}
            </Button>
          }
        />
      )}

      <QuoteForm
        form={form}
        initialValues={currentQuote}
        onSubmit={onSubmit}
        onCancel={() => navigate(`/admin/quote/read/${id}`)}
        loading={loading}
        isLocked={isLocked}
      />
    </Card>
  );
}