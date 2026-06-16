import { ErpLayout } from "@/layout";
import ErpPanel from "@/modules/ErpPanelModule";
import useLanguage from "@/locale/useLanguage";

export default function PaymentDataTableModule({ config }) {
  const translate = useLanguage();

  // ✅ fallback config so ErpPanel/DeleteItem/DataTable never gets undefined
  const safeConfig = config || {
    entity: "payment",
    DATATABLE_TITLE: translate("Payments"),
    ADD_NEW_ENTITY: translate("Add New Payment"),
    dataTableColumns: [],          // you can fill later
    disableAdd: true,              // payments normally created via invoice "Record Payment"
    searchConfig: { entity: "invoice" },
    basePath: "/admin",            // ✅ your routes are /admin/*
  };

  if (!safeConfig.basePath) safeConfig.basePath = "/admin";

  return (
    <ErpLayout>
      <ErpPanel config={safeConfig} />
    </ErpLayout>
  );
}