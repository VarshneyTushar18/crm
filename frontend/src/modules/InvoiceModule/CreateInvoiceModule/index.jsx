import React, { useState, useEffect } from 'react';
import { Button, Form, Input, Select, DatePicker, InputNumber, Card, Radio, Divider, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ErpLayout } from '@/layout';
import useLanguage from '@/locale/useLanguage';
import { invoiceApi } from '../invoiceApi';

const { Option } = Select;
const { TextArea } = Input;

export default function CreateInvoiceModule() {
  const translate = useLanguage();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [invoiceType, setInvoiceType] = useState('Progress Payment');
  const [items, setItems] = useState([{ itemName: '', description: '', quantity: 1, price: 0, total: 0 }]);

  const [calculatedAmount, setCalculatedAmount] = useState(0);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async (searchText = '') => {
    try {
      const response = await invoiceApi.searchJobs(searchText);
      setJobs(response.result || []);
    } catch (error) {
      message.error('Failed to load jobs');
    }
  };

  const handleJobChange = (jobId) => {
    const job = jobs.find(j => j._id === jobId);
    setSelectedJob(job);
    // Recalculate amount if percentage is set
    const percentage = form.getFieldValue('percentageOfContract');
    if (percentage && job) {
      setCalculatedAmount((job.lockedValue * percentage) / 100);
    }
  };

  const handleInvoiceTypeChange = (value) => {
    setInvoiceType(value);
    if (value === 'Progress Payment' && selectedJob) {
      // Auto-fill based on contract
      form.setFieldsValue({
        percentageOfContract: 25, // Default 25%
      });
      setCalculatedAmount((selectedJob.lockedValue * 25) / 100);
    }
  };

  const handlePercentageChange = (value) => {
    if (selectedJob && value) {
      setCalculatedAmount((selectedJob.lockedValue * value) / 100);
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
    setLoading(true);
    try {
      const invoiceData = {
        ...values,
        items: ['Progress Payment', 'Retention'].includes(invoiceType) ? [] : items, // Items auto-generated
      };

      const response = await invoiceApi.create(invoiceData);
      if (response.success) {
        message.success('Invoice created successfully');
        navigate('/admin/invoice');
      } else {
        message.error(response.message || 'Failed to create invoice');
      }
    } catch (error) {
      message.error('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ErpLayout>
      <Card title={translate('Create Invoice')} style={{ maxWidth: 800, margin: '0 auto' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            invoiceType: 'Progress Payment',
            currency: 'USD',
            taxRate: 0,
          }}
        >
          {/* Job Selection */}
          <Form.Item
            name="job"
            label={translate('Job')}
            rules={[{ required: true, message: 'Please select a job' }]}
          >
            <Select
              placeholder={translate('Select Job')}
              onChange={handleJobChange}
              showSearch
              filterOption={false}
              onSearch={(value) => loadJobs(value)}
              notFoundContent={null}
            >
              {jobs.map(job => (
                <Option key={job._id} value={job._id}>
                  {job.jobId} - {job.customer} (${job.lockedValue})
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* Invoice Type */}
          <Form.Item name="invoiceType" label={translate('Invoice Type')}>
            <Radio.Group onChange={(e) => handleInvoiceTypeChange(e.target.value)}>
              <Radio value="Progress Payment">Progress Payment</Radio>
              <Radio value="Variation">Variation</Radio>
              <Radio value="Final">Final</Radio>
              <Radio value="Retention">Retention</Radio>
            </Radio.Group>
          </Form.Item>

          {/* Progress Payment Fields */}
          {invoiceType === 'Progress Payment' && (
            <>
              <Form.Item name="stage" label={translate('Project Stage')}>
                <Select placeholder={translate('Select Stage')}>
                  <Option value="siteMeasurement">Site Measurement</Option>
                  <Option value="drafting">Drafting</Option>
                  <Option value="clientApproval">Client Approval</Option>
                  <Option value="materialPurchasing">Material Purchasing</Option>
                  <Option value="fabrication">Fabrication</Option>
                  <Option value="finishing">Finishing</Option>
                  <Option value="installation">Installation</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="percentageOfContract"
                label={`${translate('Percentage of Contract')} (${selectedJob?.lockedValue || 0})`}
                rules={[{ required: true, message: 'Please enter percentage' }]}
              >
                <InputNumber
                  min={0}
                  max={100}
                  formatter={value => `${value}%`}
                  parser={value => value.replace('%', '')}
                  onChange={handlePercentageChange}
                />
              </Form.Item>
              {calculatedAmount > 0 && (
                <div style={{ marginBottom: 16, color: '#1890ff' }}>
                  <strong>Calculated Amount: ${calculatedAmount.toFixed(2)}</strong>
                </div>
              )}
            </>
          )}

          {/* Retention Invoice Info */}
          {invoiceType === 'Retention' && (
            <Card size="small" style={{ marginBottom: 16, borderLeft: '4px solid #1890ff' }}>
              <p>
                <strong>Retention Calculation:</strong> This invoice will be automatically calculated based on the Job's retention rate ({selectedJob?.retentionPercentage || 5}%).
              </p>
              {selectedJob && (
                <div style={{ color: '#1890ff' }}>
                  <strong>Estimated Amount: ${(selectedJob.lockedValue * (selectedJob.retentionPercentage || 5) / 100).toFixed(2)}</strong>
                </div>
              )}
            </Card>
          )}

          {/* Manual Items (for non-progress/non-retention payments) */}
          {!['Progress Payment', 'Retention'].includes(invoiceType) && (
            <>
              <Divider>Invoice Items</Divider>
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
            </>
          )}

          {/* Common Fields */}
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

          <Form.Item name="notes" label={translate('Notes')}>
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ marginRight: 8 }}>
              {translate('Create Invoice')}
            </Button>
            <Button onClick={() => navigate('/admin/invoice')}>
              {translate('Cancel')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </ErpLayout>
  );
}