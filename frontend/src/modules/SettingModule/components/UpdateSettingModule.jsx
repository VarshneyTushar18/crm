import { Divider } from "antd";
import { PageHeader } from "@ant-design/pro-layout";
import UpdateSettingForm from "./UpdateSettingForm";

export default function UpdateSettingModule({
  config,
  children,
  withUpload = false,
  uploadSettingKey = null,
}) {
  // ✅ stop crash
  if (!config) return null;

  return (
    <>
      <PageHeader
        title={config.SETTINGS_TITLE || "Settings"}
        ghost={false}
        style={{ padding: "20px 0px" }}
      />
      <Divider />
      <UpdateSettingForm
        config={config}
        withUpload={withUpload}
        uploadSettingKey={uploadSettingKey}
      >
        {children}
      </UpdateSettingForm>
    </>
  );
}