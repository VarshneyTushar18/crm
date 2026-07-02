import { Button, Card, Select, Space, Table, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { listPurchaseOrders, receivePurchaseOrder, updatePurchaseOrder } from "@/api/phase1Api";

const colors = {
  Ordered: "blue",
  Delayed: "orange",
  "Partially Received": "gold",
  Received: "green",
  Cancelled: "red",
};

export default function PurchaseOrders() {
  const [rows, setRows] = useState([]);

  const load = async () => {
    const res = await listPurchaseOrders();
    setRows(res.data?.result || []);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <Card title="Purchase Orders">
        <Table
          rowKey="_id"
          dataSource={rows}
          columns={[
            { title: "PO #", dataIndex: "poNumber" },
            {
              title: "Job",
              render: (_, r) => r.jobId?.jobId || "-",
            },
            {
              title: "Supplier",
              render: (_, r) => r.supplierId?.name || "-",
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (v) => <Tag color={colors[v] || "default"}>{v}</Tag>,
            },
            {
              title: "Lines",
              render: (_, r) => r.lines?.length || 0,
            },
            {
              title: "Action",
              render: (_, r) => (
                <Space>
                  <Select
                    size="small"
                    style={{ width: 160 }}
                    value={r.status}
                    onChange={async (status) => {
                      await updatePurchaseOrder(r._id, { status });
                      message.success("PO status updated");
                      load();
                    }}
                    options={[
                      "Ordered",
                      "Delayed",
                      "Partially Received",
                      "Received",
                      "Cancelled",
                    ].map((v) => ({ value: v, label: v }))}
                  />
                  <Button
                    size="small"
                    onClick={async () => {
                      const lines = (r.lines || []).map((line) => ({
                        lineId: line._id,
                        receivedQty: line.orderedQty,
                      }));
                      await receivePurchaseOrder(r._id, { lines });
                      message.success("Full receipt recorded");
                      load();
                    }}
                  >
                    Mark Received
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
