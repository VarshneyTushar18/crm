import { ErpLayout } from "@/layout";
import ErpPanel from "@/modules/ErpPanelModule";
import useLanguage from "@/locale/useLanguage";

export default function InvoiceDataTableModule({ config }) {
  const translate = useLanguage();

  const safeConfig = config || {
    entity: "invoice",
    DATATABLE_TITLE: translate("Invoices"),
    ADD_NEW_ENTITY: translate("Add New Invoice"),
    dataTableColumns: [
      {
        title: translate("Invoice Number"),
        dataIndex: "number",
      },
      {
        title: translate("Job"),
        dataIndex: ["job", "jobId"],
      },
      {
        title: translate("Customer"),
        dataIndex: ["job", "customer"],
      },
      {
        title: translate("Status"),
        dataIndex: "status",
        render: (status, record) => {
          const statusColors = {
            'Draft': 'orange',
            'Issued': 'blue',
            'Partially Paid': 'purple',
            'Paid': 'green',
            'Overdue': 'red'
          };
          return (
            <div>
              <span style={{ color: statusColors[status] || 'black', fontWeight: 600 }}>{status}</span>
              {record.paymentNotified && (
                <div style={{ marginTop: 4 }}>
                  <span style={{ 
                    fontSize: '10px', 
                    background: '#e6fffb', 
                    color: '#08979c', 
                    border: '1px solid #87e8de',
                    padding: '1px 4px',
                    borderRadius: '4px'
                  }}>
                    CLAIMED PAID
                  </span>
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: translate("Total Amount"),
        dataIndex: "total",
        render: (total, record) => `$${total?.toFixed(2)} ${record.currency}`,
      },
      {
        title: translate("Amount Paid"),
        dataIndex: "amountPaid",
        render: (amountPaid, record) => `$${amountPaid?.toFixed(2)} ${record.currency}`,
      },
      {
        title: translate("Amount Due"),
        dataIndex: "amountDue",
        render: (amountDue, record) => `$${amountDue?.toFixed(2)} ${record.currency}`,
      },
      {
        title: translate("Date"),
        dataIndex: "date",
        render: (date) => new Date(date).toLocaleDateString(),
      },
    ],
    searchConfig: {
      entity: "job",
      displayLabels: ["jobId"],
      searchFields: "jobId",
    },
    deleteModalLabels: ["number", "job.jobId"],
    basePath: "/admin",
  };

  if (!safeConfig.basePath) safeConfig.basePath = "/admin";

  return (
    <ErpLayout>
      <ErpPanel config={safeConfig} />
    </ErpLayout>
  );
}