import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Select, DatePicker, message, Spin, InputNumber } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { ErpLayout } from '@/layout';
import useLanguage from '@/locale/useLanguage';
import { invoiceApi } from '../invoiceApi';
import dayjs from 'dayjs';

const { Option } = Select;

export default function RecordPaymentModule() {
  const translate = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [paymentModes, setPaymentModes] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInvoice();
    loadPaymentModes();
  }, [id]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const response = await invoiceApi.read(id);
      if (response.success) {
        setInvoice(response.result);
        // Set default values
        form.setFieldsValue({
          date: dayjs(),
          currency: response.result.currency || 'USD',
        });
      } else {
        message.error('Failed to load invoice');
        navigate('/admin/invoice');
      }
    } catch (error) {
      message.error('Failed to load invoice');
      navigate('/admin/invoice');
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentModes = async () => {
    try {
      const response = await invoiceApi.getPaymentModes();
      if (response.success) {
        setPaymentModes(response.result || []);
      }
    } catch (error) {
      console.error('Failed to load payment modes');
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      // Validate amount
      if (values.amount <= 0) {
        message.error('Payment amount must be greater than 0');
        return;
      }

      if (values.amount > invoice.amountDue) {
        message.error(`Payment amount cannot exceed the amount due: $${invoice.amountDue.toFixed(2)}`);
        return;
      }

      const paymentData = {
        ...values,
        invoice: id,
        date: values.date.toDate(),
      };

      const response = await invoiceApi.createPayment(paymentData);

      if (response.success) {
        message.success('Payment recorded successfully');
        navigate(`/admin/invoice/read/${id}`);
      } else {
        message.error(response.message || 'Failed to record payment');
      }
    } catch (error) {
      message.error('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ErpLayout>
        <Card>
          <Spin size="large" />
        </Card>
      </ErpLayout>
    );
  }

  if (!invoice) {
    return (
      <ErpLayout>
        <Card>Invoice not found</Card>
      </ErpLayout>
    );
  }

  return (
    <ErpLayout>
      <Card title={`Record Payment for Invoice ${invoice.number}`}>
        <div style={{ marginBottom: 16 }}>
          <strong>Invoice Details:</strong>
          <p>Job: {invoice.job?.jobId}</p>
          <p>Customer: {invoice.job?.customer}</p>
          <p>Total Amount: ${invoice.total?.toFixed(2)}</p>
          <p>Amount Paid: ${invoice.amountPaid?.toFixed(2)}</p>
          <p>Amount Due: ${invoice.amountDue?.toFixed(2)}</p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            date: dayjs(),
            currency: invoice.currency || 'USD',
          }}
        >
          <Form.Item
            name="date"
            label="Payment Date"
            rules={[{ required: true, message: 'Please select payment date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="amount"
            label="Payment Amount"
            rules={[
              { required: true, message: 'Please enter payment amount' },
              { type: 'number', min: 0.01, message: 'Amount must be greater than 0' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={invoice.amountDue}
              step={0.01}
              formatter={(value) => `${invoice.currency === 'INR' ? '₹' : '$'} ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value.replace(/\$\s?|(₹)\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item
            name="currency"
            label="Currency"
            rules={[{ required: true, message: 'Please select currency' }]}
          >
            <Select>
              <Option value="INR">INR</Option>
              <Option value="USD">USD</Option>
              <Option value="EUR">EUR</Option>
              <Option value="GBP">GBP</Option>
              <Option value="AUD">AUD</Option>
              <Option value="CAD">CAD</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="paymentMode"
            label="Payment Method"
            rules={[{ required: true, message: 'Please select payment method' }]}
          >
            <Select placeholder="Select payment method">
              {paymentModes.map(mode => (
                <Option key={mode._id} value={mode._id}>
                  {mode.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="ref" label="Reference Number">
            <Input placeholder="Cheque number, transaction ID, etc." />
          </Form.Item>

          <Form.Item name="description" label="Description/Notes">
            <Input.TextArea rows={3} placeholder="Additional payment details" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Record Payment
            </Button>
            <Button
              style={{ marginLeft: 8 }}
              onClick={() => navigate(`/admin/invoice/read/${id}`)}
            >
              Cancel
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </ErpLayout>
  );
}