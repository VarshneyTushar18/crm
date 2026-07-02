import { Tag, Divider } from "antd";
import dayjs from "dayjs";
import BrandLogo from "@/components/BrandLogo";

const statusColor = (status) => {
  switch (status) {
    case "Paid":
      return "success";
    case "Partially Paid":
      return "warning";
    case "Overdue":
      return "error";
    case "Issued":
      return "processing";
    default:
      return "default";
  }
};

const formatMoney = (amount, currency = "AUD") => {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "AUD",
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || ""} ${value.toFixed(2)}`;
  }
};

export default function CustomerInvoiceTemplate({ data }) {
  const invoice = data?.invoice;
  const company = data?.company || {};
  const billTo = data?.billTo || {};

  if (!invoice) return null;

  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <div className="customer-invoice-template">
      <style>{`
        .customer-invoice-template {
          background: #fff;
          color: #1f1f1f;
          font-family: "Segoe UI", Arial, sans-serif;
          font-size: 14px;
          line-height: 1.5;
        }
        .customer-invoice-template .invoice-header {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }
        .customer-invoice-template .invoice-brand h1 {
          margin: 0 0 4px;
          font-size: 18px;
          color: #1f1f1f;
        }
        .customer-invoice-template .invoice-brand p,
        .customer-invoice-template .invoice-meta p {
          margin: 0 0 4px;
          color: #595959;
        }
        .customer-invoice-template .invoice-title {
          font-size: 32px;
          font-weight: 700;
          color: #52008c;
          margin: 0 0 16px;
        }
        .customer-invoice-template .invoice-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        .customer-invoice-template .invoice-box {
          border: 1px solid #f0f0f0;
          border-radius: 10px;
          padding: 16px;
          background: #fafafa;
        }
        .customer-invoice-template .invoice-box h3 {
          margin: 0 0 10px;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #52008c;
        }
        .customer-invoice-template table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        .customer-invoice-template th {
          text-align: left;
          padding: 10px 12px;
          background: #f5f0fa;
          color: #52008c;
          font-size: 12px;
          text-transform: uppercase;
          border-bottom: 1px solid #e8dff2;
        }
        .customer-invoice-template td {
          padding: 12px;
          border-bottom: 1px solid #f0f0f0;
          vertical-align: top;
        }
        .customer-invoice-template .num {
          text-align: right;
          white-space: nowrap;
        }
        .customer-invoice-template .item-desc {
          display: block;
          color: #8c8c8c;
          font-size: 12px;
          margin-top: 4px;
        }
        .customer-invoice-template .totals {
          margin-top: 16px;
          margin-left: auto;
          width: min(360px, 100%);
        }
        .customer-invoice-template .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .customer-invoice-template .totals-row.grand {
          font-size: 18px;
          font-weight: 700;
          color: #52008c;
          border-bottom: none;
          padding-top: 12px;
        }
        .customer-invoice-template .invoice-footer {
          margin-top: 28px;
          padding-top: 16px;
          border-top: 1px dashed #d9d9d9;
          color: #8c8c8c;
          font-size: 12px;
        }
        @media print {
          .no-print { display: none !important; }
          .customer-invoice-template { padding: 0; }
        }
      `}</style>

      <div className="invoice-header">
        <div className="invoice-brand">
          <BrandLogo variant="invoice" src={company.logoUrl || undefined} />
          <h1 style={{ margin: "10px 0 4px", fontSize: 18 }}>{company.name || "Bright Balustrading"}</h1>
          {company.address ? <p>{company.address}</p> : null}
          {company.phone ? <p>{company.phone}</p> : null}
          {company.email ? <p>{company.email}</p> : null}
          {company.regNumber ? <p>ABN / Reg: {company.regNumber}</p> : null}
        </div>
        <div className="invoice-meta" style={{ textAlign: "right" }}>
          <div className="invoice-title">INVOICE</div>
          <p>
            <strong>Invoice #:</strong> {invoice.number}
            {invoice.year ? ` / ${invoice.year}` : ""}
          </p>
          <p>
            <strong>Date:</strong> {invoice.date ? dayjs(invoice.date).format("DD MMM YYYY") : "—"}
          </p>
          <p>
            <strong>Due date:</strong>{" "}
            {invoice.expiredDate ? dayjs(invoice.expiredDate).format("DD MMM YYYY") : "—"}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            <Tag color={statusColor(invoice.status)}>{invoice.status}</Tag>
          </p>
        </div>
      </div>

      <div className="invoice-grid">
        <div className="invoice-box">
          <h3>Bill To</h3>
          <p style={{ margin: 0, fontWeight: 600 }}>{billTo.name || invoice.job?.customer || "—"}</p>
          {billTo.contactPerson ? <p style={{ margin: "4px 0 0" }}>{billTo.contactPerson}</p> : null}
          {billTo.address ? <p style={{ margin: "4px 0 0" }}>{billTo.address}</p> : null}
          {billTo.email ? <p style={{ margin: "4px 0 0" }}>{billTo.email}</p> : null}
          {billTo.phone ? <p style={{ margin: "4px 0 0" }}>{billTo.phone}</p> : null}
        </div>
        <div className="invoice-box">
          <h3>Project Details</h3>
          <p style={{ margin: 0 }}>
            <strong>Job:</strong> {invoice.job?.jobId || "—"}
          </p>
          <p style={{ margin: "8px 0 0" }}>
            <strong>Site:</strong> {invoice.job?.site || "—"}
          </p>
          <p style={{ margin: "8px 0 0" }}>
            <strong>Invoice type:</strong> {invoice.invoiceType || "—"}
          </p>
          {invoice.percentageOfContract ? (
            <p style={{ margin: "8px 0 0" }}>
              <strong>Contract %:</strong> {invoice.percentageOfContract}%
            </p>
          ) : null}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item / Description</th>
            <th className="num">Qty</th>
            <th className="num">Unit Price</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.length ? (
            items.map((item, index) => (
              <tr key={`${item.itemName}-${index}`}>
                <td>
                  {item.itemName}
                  {item.description ? (
                    <span className="item-desc">{item.description}</span>
                  ) : null}
                </td>
                <td className="num">{item.quantity ?? 1}</td>
                <td className="num">{formatMoney(item.price, invoice.currency)}</td>
                <td className="num">{formatMoney(item.total, invoice.currency)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4}>No line items</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="totals">
        <div className="totals-row">
          <span>Subtotal</span>
          <span>{formatMoney(invoice.subTotal, invoice.currency)}</span>
        </div>
        <div className="totals-row">
          <span>Tax ({Number(invoice.taxRate || 0)}%)</span>
          <span>{formatMoney(invoice.taxTotal, invoice.currency)}</span>
        </div>
        <div className="totals-row grand">
          <span>Total</span>
          <span>{formatMoney(invoice.total, invoice.currency)}</span>
        </div>
        <div className="totals-row">
          <span>Amount paid</span>
          <span>{formatMoney(invoice.amountPaid, invoice.currency)}</span>
        </div>
        <div className="totals-row" style={{ fontWeight: 600 }}>
          <span>Balance due</span>
          <span>{formatMoney(invoice.amountDue, invoice.currency)}</span>
        </div>
      </div>

      {invoice.notes ? (
        <>
          <Divider style={{ margin: "20px 0 12px" }} />
          <div>
            <strong>Notes</strong>
            <p style={{ margin: "8px 0 0", color: "#595959" }}>{invoice.notes}</p>
          </div>
        </>
      ) : null}

      <div className="invoice-footer">
        <p style={{ margin: 0 }}>
          Payment terms: please pay by the due date shown above. For bank transfer, include invoice
          number <strong>{invoice.number}</strong> as the payment reference.
        </p>
        {company.bankDetails ? (
          <p style={{ margin: "8px 0 0" }}>{company.bankDetails}</p>
        ) : null}
      </div>
    </div>
  );
}
