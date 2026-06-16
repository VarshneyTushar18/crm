import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Button, Tag, Table, message, Modal, Typography, Space } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { ErpLayout } from '@/layout';
import useLanguage from '@/locale/useLanguage';
import { invoiceApi } from '../invoiceApi';
import dayjs from 'dayjs';

const { Text } = Typography;
const { confirm } = Modal;

export default function ReadInvoiceModule() {
  const translate = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoice();
    loadPayments();
  }, [id]);

  const loadInvoice = async () => {
    try {
      const response = await invoiceApi.read(id);
      if (response.success) {
        setInvoice(response.result);
      } else {
        message.error('Failed to load invoice');
      }
    } catch (error) {
      message.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      const response = await invoiceApi.listPayments({ filter: `invoice=${id}` });
      setPayments(response.result || []);
    } catch (error) {
      console.error('Failed to load payments');
    }
  };

  const handleIssue = async () => {
    try {
      const response = await invoiceApi.issue(id);
      if (response.success) {
        message.success('Invoice issued successfully');
        loadInvoice();
      } else {
        message.error(response.message || 'Failed to issue invoice');
      }
    } catch (error) {
      message.error('Failed to issue invoice');
    }
  };

  const handleDelete = () => {
    confirm({
      title: 'Are you sure you want to delete this invoice?',
      content: 'This action cannot be undone.',
      onOk: async () => {
        try {
          const response = await invoiceApi.delete(id);
          if (response.success) {
            message.success('Invoice deleted successfully');
            navigate('/admin/invoice');
          } else {
            message.error('Failed to delete invoice');
          }
        } catch (error) {
          message.error('Failed to delete invoice');
        }
      },
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'orange',
      'Issued': 'blue',
      'Partially Paid': 'purple',
      'Paid': 'green',
      'Overdue': 'red'
    };
    return colors[status] || 'default';
  };

  const paymentColumns = [
    {
      title: 'Payment Date',
      dataIndex: 'date',
      render: (date) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      render: (amount, record) => `$${amount?.toFixed(2)} ${record.currency}`,
    },
    {
      title: 'Payment Method',
      dataIndex: ['paymentMode', 'name'],
    },
    {
      title: 'Reference',
      dataIndex: 'ref',
    },
  ];

  if (loading) {
    return <ErpLayout><Card loading /></ErpLayout>;
  }

  if (!invoice) {
    return <ErpLayout><Card>Invoice not found</Card></ErpLayout>;
  }

  return (
    <ErpLayout>
      <Card
        title={`Invoice ${invoice.number}`}
        extra={
          <div>
            {invoice.status === 'Draft' && (
              <Button type="primary" onClick={handleIssue} style={{ marginRight: 8 }}>
                Issue Invoice
              </Button>
            )}
            {invoice.status === 'Draft' && (
              <Button onClick={() => navigate(`/admin/invoice/update/${id}`)} style={{ marginRight: 8 }}>
                Edit
              </Button>
            )}
            {invoice.status === 'Draft' && (
              <Button danger onClick={handleDelete}>
                Delete
              </Button>
            )}
          </div>
        }
      >
        {invoice.paymentNotified && (
          <Card 
            size="small" 
            style={{ marginBottom: 16, border: '1px solid #87e8de', background: '#e6fffb' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Tag color="cyan">CUSTOMER PAYMENT CLAIM</Tag>
                <Text strong>Customer notified payment on {dayjs(invoice.notificationDate).format('DD MMM YYYY')}</Text>
                <div style={{ fontSize: '12px', marginTop: 4 }}>
                   Ref: {invoice.paymentRef} | Mode: {invoice.paymentMode}
                </div>
              </div>
              <Space>
                <Button 
                  type="primary" 
                  size="small" 
                  onClick={async () => {
                    setLoading(true);
                    const res = await invoiceApi.verifyPayment(id, { action: 'approve' });
                    if (res.success) {
                      message.success('Payment approved and recorded');
                      loadInvoice();
                      loadPayments();
                    }
                    setLoading(false);
                  }}
                >
                  Approve Claim
                </Button>
                <Button 
                  danger 
                  size="small"
                  onClick={async () => {
                    setLoading(true);
                    const res = await invoiceApi.verifyPayment(id, { action: 'reject' });
                    if (res.success) {
                      message.success('Payment claim rejected');
                      loadInvoice();
                    }
                    setLoading(false);
                  }}
                >
                  Reject
                </Button>
              </Space>
            </div>
          </Card>
        )}
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Invoice Number">{invoice.number}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={getStatusColor(invoice.status)}>{invoice.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Job">{invoice.job?.jobId}</Descriptions.Item>
          <Descriptions.Item label="Customer">{invoice.job?.customer}</Descriptions.Item>
          <Descriptions.Item label="Invoice Date">
            {dayjs(invoice.date).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Due Date">
            {dayjs(invoice.expiredDate).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Invoice Type">{invoice.invoiceType}</Descriptions.Item>
          <Descriptions.Item label="Currency">{invoice.currency}</Descriptions.Item>
          {invoice.percentageOfContract && (
            <Descriptions.Item label="Contract Percentage">
              {invoice.percentageOfContract}%
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Sub Total">${invoice.subTotal?.toFixed(2)}</Descriptions.Item>
          <Descriptions.Item label="Tax">${invoice.taxTotal?.toFixed(2)}</Descriptions.Item>
          <Descriptions.Item label="Total Amount">
            <strong>${invoice.total?.toFixed(2)}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Amount Paid">
            <strong>${invoice.amountPaid?.toFixed(2)}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Amount Due">
            <strong>${invoice.amountDue?.toFixed(2)}</strong>
          </Descriptions.Item>
        </Descriptions>

        {invoice.notes && (
          <Card title="Notes" style={{ marginTop: 16 }}>
            {invoice.notes}
          </Card>
        )}

        {invoice.items && invoice.items.length > 0 && (
          <Card title="Invoice Items" style={{ marginTop: 16 }}>
            <Table
              dataSource={invoice.items}
              columns={[
                { title: 'Item Name', dataIndex: 'itemName' },
                { title: 'Description', dataIndex: 'description' },
                { title: 'Quantity', dataIndex: 'quantity' },
                { title: 'Price', dataIndex: 'price', render: (price) => `$${price?.toFixed(2)}` },
                { title: 'Total', dataIndex: 'total', render: (total) => `$${total?.toFixed(2)}` },
              ]}
              pagination={false}
              size="small"
            />
          </Card>
        )}

        <Card title="Payment History" style={{ marginTop: 16 }}>
          <Table
            dataSource={payments}
            columns={paymentColumns}
            pagination={false}
            size="small"
          />
          {['Issued', 'Partially Paid', 'Overdue'].includes(invoice.status) && invoice.amountDue > 0 ? (
            <Button
              type="primary"
              style={{ marginTop: 16 }}
              onClick={() => navigate(`/admin/invoice/record-payment/${id}`)}
            >
              Record Payment
            </Button>
          ) : null}
        </Card>
      </Card>
    </ErpLayout>
  );
}