import React, { useState, useEffect } from 'react';
import { Button, Form, Input, Select, DatePicker, InputNumber, Card, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { ErpLayout } from '@/layout';
import useLanguage from '@/locale/useLanguage';
import { invoiceApi } from '../invoiceApi';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

export default function UpdateInvoiceModule() {
  const translate = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    try {
      const response = await invoiceApi.read(id);
      if (response.success) {
        setInvoice(response.result);
        setItems(response.result.items || []);
        form.setFieldsValue({
          ...response.result,
          date: response.result.date ? dayjs(response.result.date) : null,
          expiredDate: response.result.expiredDate ? dayjs(response.result.expiredDate) : null,
        });
      } else {
        message.error('Failed to load invoice');
      }
    } catch (error) {
      message.error('Failed to load invoice');
    }
  };

  const calculateItemTotal = (index, quantity, price) => {
    const newItems = [...items];
    newItems[index].total = quantity * price;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { itemName: '', description: '', quantity: 1, price: 0, total: 0 }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const onFinish = async (values) => {
    if (invoice?.status !== 'Draft') {
      message.error('Only draft invoices can be edited');
      return;
    }

    setLoading(true);
    try {
      const invoiceData = {
        ...values,
        items,
        job: invoice.job?._id || invoice.job,
      };

      const response = await invoiceApi.update(id, invoiceData);
      if (response.success) {
        message.success('Invoice updated successfully');
        navigate(`/admin/invoice/read/${id}`);
      } else {
        message.error(response.message || 'Failed to update invoice');
      }
    } catch (error) {
      message.error('Failed to update invoice');
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) {
    return <ErpLayout><Card loading /></ErpLayout>;
  }

  if (invoice.status !== 'Draft') {
    return (
      <ErpLayout>
        <Card>
          <p>This invoice cannot be edited because it has been {invoice.status.toLowerCase()}.</p>
          <Button onClick={() => navigate(`/admin/invoice/read/${id}`)}>
            Back to Invoice
          </Button>
        </Card>
      </ErpLayout>
    );
  }

  return (
    <ErpLayout>
      <Card title={translate('Update Invoice')} style={{ maxWidth: 800, margin: '0 auto' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            name="date"
            label={translate('Invoice Date')}
            rules={[{ required: true, message: 'Please select invoice date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="expiredDate"
            label={translate('Due Date')}
            rules={[{ required: true, message: 'Please select due date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="currency" label={translate('Currency')}>
            <Select>
              <Option value="USD">USD</Option>
              <Option value="EUR">EUR</Option>
              <Option value="GBP">GBP</Option>
              <Option value="INR">INR</Option>
            </Select>
          </Form.Item>

          <Form.Item name="taxRate" label={translate('Tax Rate (%)')}>
            <InputNumber min={0} max={100} />
          </Form.Item>

          {/* Invoice Items */}
          <Card title="Invoice Items" style={{ marginBottom: 16 }}>
            {items.map((item, index) => (
              <Card key={index} size="small" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'end' }}>
                  <Form.Item style={{ flex: 2 }}>
                    <Input
                      placeholder="Item Name"
                      value={item.itemName}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].itemName = e.target.value;
                        setItems(newItems);
                      }}
                    />
                  </Form.Item>
                  <Form.Item style={{ flex: 1 }}>
                    <InputNumber
                      placeholder="Qty"
                      min={1}
                      value={item.quantity}
                      onChange={(value) => {
                        const newItems = [...items];
                        newItems[index].quantity = value;
                        calculateItemTotal(index, value, item.price);
                        setItems(newItems);
                      }}
                    />
                  </Form.Item>
                  <Form.Item style={{ flex: 1 }}>
                    <InputNumber
                      placeholder="Price"
                      min={0}
                      value={item.price}
                      onChange={(value) => {
                        const newItems = [...items];
                        newItems[index].price = value;
                        calculateItemTotal(index, item.quantity, value);
                        setItems(newItems);
                      }}
                    />
                  </Form.Item>
                  <Form.Item style={{ flex: 1 }}>
                    <InputNumber
                      placeholder="Total"
                      value={item.total}
                      readOnly
                    />
                  </Form.Item>
                  {items.length > 1 && (
                    <Button type="link" danger onClick={() => removeItem(index)}>
                      Remove
                    </Button>
                  )}
                </div>
              </Card>
            ))}
            <Button type="dashed" onClick={addItem} style={{ width: '100%' }}>
              Add Item
            </Button>
          </Card>

          <Form.Item name="notes" label={translate('Notes')}>
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ marginRight: 8 }}>
              {translate('Update Invoice')}
            </Button>
            <Button onClick={() => navigate(`/admin/invoice/read/${id}`)}>
              {translate('Cancel')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </ErpLayout>
  );
}