import React, { useMemo, useState } from "react";
import { Card, Form, message, Alert } from "antd";
import { useLocation, useNavigate } from "react-router-dom";

import QuoteForm from "../Forms/QuoteForm";
import { createQuote } from "../quoteApi";

export default function CreateQuoteModule() {
  const [form] = Form.useForm();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // ✅ Lead comes from Lead page via navigate state
  const lead = location.state?.lead;

  // ✅ Prefill from lead (PPT/SOW flow)
  const initialValues = useMemo(() => {
    if (!lead) return {};

    return {
      leadId: lead?._id,

      // customer snapshot (from lead form)
      customerName: lead?.clientName || "",
      contactPerson: lead?.contactPerson || "",
      phone: lead?.phone || "",
      email: lead?.email || "",

      // project
      siteAddress: lead?.siteAddress || "",
      leadSource: lead?.leadSource || "Manual Entry",

      // quote defaults
      status: "Draft",

      // defaults to avoid undefined
      materialCost: 0,
      laborCost: 0,
      installCost: 0,
      totalAmount: 0,

      expectedDraftHours: 0,
      expectedFabHours: 0,
      expectedInstallHours: 0,
      crewSize: 1,
    };
  }, [lead]);

  const onSubmit = async (values) => {
    try {
      setLoading(true);

      // ✅ Must have leadId (since Quote created from Lead)
      if (!values?.leadId) {
        message.error("Lead missing. Please create quote from Lead page.");
        return;
      }

      // ✅ API call (saves in DB)
      const res = await createQuote(values);

      if (!res?.success) {
        throw new Error(res?.message || "Failed to create quote");
      }

      message.success(res?.message || "Quote created");
      navigate("/admin/quotes"); // go back to list
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Create quote failed");
    } finally {
      setLoading(false);
    }
  };

  // ✅ if direct URL open without lead state
  if (!lead) {
    return (
      <Card title="Create Quote">
        <Alert
          type="warning"
          showIcon
          message="Create Quote from Lead only"
          description="Go to Leads page and click 'Create Quote' against a Lead."
        />
      </Card>
    );
  }

  return (
    <Card title={`Create Quote (Lead: ${lead?.clientName || ""})`} bordered>
      <QuoteForm
        form={form}
        initialValues={initialValues}
        onSubmit={onSubmit}
        onCancel={() => navigate("/admin/lead")}
        loading={loading}
      />
    </Card>
  );
}