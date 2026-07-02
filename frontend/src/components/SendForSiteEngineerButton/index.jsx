import { useState } from "react";
import { Button, message } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { sendForSiteEngineerApproval } from "@/api/extensionApi";

export default function SendForSiteEngineerButton({
  jobId,
  stageKey,
  workflowEvents,
  onSent,
  disabled = false,
  disabledReason,
  size,
}) {
  const [loading, setLoading] = useState(false);
  const stage = workflowEvents?.[stageKey] || {};
  const awaiting = stage.siteEngineerStatus === "Pending" && stage.moduleWorkComplete;
  const approved = stage.siteEngineerStatus === "Approved" && stage.isCompleted;
  const rejected = stage.siteEngineerStatus === "Rejected";

  const handleSend = async () => {
    if (!jobId) {
      message.warning("Select a job first");
      return;
    }

    if (disabled) {
      message.warning(disabledReason || "Complete required work before sending for approval");
      return;
    }

    try {
      setLoading(true);
      const res = await sendForSiteEngineerApproval(jobId, stageKey);
      message.success(res?.message || "Sent to site engineer for approval");
      if (onSent) onSent(res?.result);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to send for approval");
    } finally {
      setLoading(false);
    }
  };

  if (approved) {
    return (
      <Button disabled size={size}>
        SE Approved
      </Button>
    );
  }

  if (awaiting) {
    return (
      <Button disabled size={size}>
        Awaiting SE
      </Button>
    );
  }

  return (
    <Button
      icon={<SendOutlined />}
      onClick={handleSend}
      loading={loading}
      disabled={!jobId || disabled}
      size={size}
    >
      {rejected ? "Resend for Approval" : "Send for Approval"}
    </Button>
  );
}
