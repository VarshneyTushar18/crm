import { ErpLayout } from "@/layout";
import ErpPanel from "@/modules/ErpPanelModule";
import useLanguage from "@/locale/useLanguage";

export default function QuoteDataTableModule({ config }) {
  const translate = useLanguage();

  const safeConfig = config || {
    entity: "quote",
    DATATABLE_TITLE: translate("Quotes"),

    // ✅ Quote must come from Lead -> so disable "Add New"
    disableAdd: true,
    ADD_NEW_ENTITY: translate("Add New Quote"),

    dataTableColumns: [
      { title: translate("Quote No"), dataIndex: "quoteNumber" },
      { title: translate("Client Name"), dataIndex: "customerName" },
      { title: translate("Status"), dataIndex: "status" },
      { title: translate("Total"), dataIndex: "totalAmount" },
      { title: translate("Created"), dataIndex: "createdAt" },
    ],

    searchConfig: { entity: "quote" },
    basePath: "/admin",
    pagination: { current: 1, pageSize: 10 },
    deleteModalLabels: ["quoteNumber", "customerName"],
  };

  if (!safeConfig.basePath) safeConfig.basePath = "/admin";

  return (
    <ErpLayout>
      <ErpPanel config={safeConfig} />
    </ErpLayout>
  );
}