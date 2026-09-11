import dayjs from "dayjs";
import { ErpLayout } from "@/layout";
import ErpPanel from "@/modules/ErpPanelModule";
import useLanguage from "@/locale/useLanguage";
import { useDate } from "@/settings";

const formatPaymentAmount = (amount, currency) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)} ${currency || ""}`.trim();
};

export default function PaymentDataTableModule({ config }) {
  const translate = useLanguage();
  const { dateFormat } = useDate();

  const defaultColumns = [
    {
      title: translate("Number"),
      dataIndex: "number",
    },
    {
      title: translate("Customer"),
      dataIndex: ["invoice", "job", "customer"],
      render: (value) => value || "—",
    },
    {
      title: translate("Amount"),
      dataIndex: "amount",
      onCell: () => ({
        style: {
          textAlign: "right",
          whiteSpace: "nowrap",
          direction: "ltr",
        },
      }),
      render: (amount, record) => formatPaymentAmount(amount, record.currency),
    },
    {
      title: translate("Date"),
      dataIndex: "date",
      render: (date) => (date ? dayjs(date).format(dateFormat) : "—"),
    },
    {
      title: translate("Invoice"),
      dataIndex: ["invoice", "number"],
      render: (value) => value || "—",
    },
    {
      title: translate("Payment Mode"),
      dataIndex: ["paymentMode", "name"],
      render: (value) => value || "—",
    },
  ];

  const safeConfig = config || {
    entity: "payment",
    DATATABLE_TITLE: translate("Payments"),
    ADD_NEW_ENTITY: translate("Add New Payment"),
    disableAdd: true,
    searchConfig: {
      entity: "invoice",
      displayLabels: ["number"],
      searchFields: "number",
    },
    deleteModalLabels: ["number"],
    basePath: "/admin",
    dataTableColumns: defaultColumns,
  };

  if (!safeConfig.basePath) safeConfig.basePath = "/admin";
  if (!Array.isArray(safeConfig.dataTableColumns) || safeConfig.dataTableColumns.length === 0) {
    safeConfig.dataTableColumns = defaultColumns;
  } else {
    // Ensure Amount column uses invoice-style formatting even if config was passed in
    safeConfig.dataTableColumns = safeConfig.dataTableColumns.map((col) => {
      if (col?.dataIndex === "amount") {
        return {
          ...col,
          render: (amount, record) => formatPaymentAmount(amount, record.currency),
        };
      }
      return col;
    });
  }

  return (
    <ErpLayout>
      <ErpPanel config={safeConfig} />
    </ErpLayout>
  );
}
