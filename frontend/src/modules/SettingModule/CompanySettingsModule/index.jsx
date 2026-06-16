import SetingsSection from "../components/SetingsSection";
import UpdateSettingModule from "../components/UpdateSettingModule";
import SettingsForm from "./SettingsForm";
import useLanguage from "@/locale/useLanguage";

export default function CompanySettingsModule({ config }) {
  const translate = useLanguage();

  // ✅ fallback config (route se config na aaye to bhi crash na ho)
  const safeConfig = config || {
    entity: "setting",
    settingsCategory: "company_settings", // ✅ must for UpdateSettingForm: result[settingsCategory]
    SETTINGS_TITLE: translate("Company Settings"),
  };

  return (
    <UpdateSettingModule config={safeConfig}>
      <SetingsSection
        title={translate("Company Settings")}
        description={translate("Update your Company informations")}
      >
        <SettingsForm />
      </SetingsSection>
    </UpdateSettingModule>
  );
}