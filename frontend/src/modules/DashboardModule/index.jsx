import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Row, Col, Select, DatePicker, Typography, Button, Tooltip, Badge } from 'antd';
import { ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons';
import useLanguage from '@/locale/useLanguage';
import { useMoney } from '@/settings';
import { request } from '@/request';
import useOnFetch from '@/hooks/useOnFetch';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

import RecentTable from './components/RecentTable';
import SummaryCard from './components/SummaryCard';
import PreviewCard from './components/PreviewCard';
import CustomerPreviewCard from './components/CustomerPreviewCard';

import { selectMoneyFormat } from '@/redux/settings/selectors';
import { useSelector } from 'react-redux';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const POLLING_INTERVAL_MS = 30_000; // 30 seconds

export default function DashboardModule() {
  const translate = useLanguage();
  const { moneyFormatter } = useMoney();
  const money_format_settings = useSelector(selectMoneyFormat);

  const [dateFilter, setDateFilter] = useState({
    type: 'thisMonth',
    startDate: null,
    endDate: null,
  });

  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollingRef = useRef(null);

  const getStatsData = async ({ entity, currency, type, startDate, endDate }) => {
    return await request.summary({
      entity,
      options: {
        currency,
        type,
        ...(startDate && { startDate: startDate.format('YYYY-MM-DD') }),
        ...(endDate && { endDate: endDate.format('YYYY-MM-DD') }),
      },
    });
  };

  const {
    result: invoiceResult,
    isLoading: invoiceLoading,
    onFetch: fetchInvoicesStats,
  } = useOnFetch();

  const { result: quoteResult, isLoading: quoteLoading, onFetch: fetchQuotesStats } = useOnFetch();

  const {
    result: paymentResult,
    isLoading: paymentLoading,
    onFetch: fetchPayemntsStats,
  } = useOnFetch();

  const {
    result: jobResult,
    isLoading: jobLoading,
    onFetch: fetchJobsStats,
  } = useOnFetch();

  const { result: clientResult, isLoading: clientLoading, onFetch: fetchClientStats } = useOnFetch();

  const fetchAll = useCallback(() => {
    const currency = money_format_settings?.default_currency_code || null;
    if (!currency) return;

    const params = {
      currency,
      type: dateFilter.type,
      startDate: dateFilter.startDate,
      endDate: dateFilter.endDate,
    };

    fetchInvoicesStats(getStatsData({ entity: 'invoice', ...params }));
    fetchQuotesStats(getStatsData({ entity: 'quote', ...params }));
    fetchPayemntsStats(getStatsData({ entity: 'payment', ...params }));
    fetchJobsStats(getStatsData({ entity: 'job', ...params }));
    fetchClientStats(request.summary({ entity: 'client' }));
    setLastUpdated(dayjs());
  }, [money_format_settings?.default_currency_code, dateFilter]);

  // Fetch on mount and when filters / currency change
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Polling: auto-refresh every 30 seconds
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchAll();
    }, POLLING_INTERVAL_MS);
    return () => clearInterval(pollingRef.current);
  }, [fetchAll]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchAll();
    setTimeout(() => setRefreshing(false), 800);
  };

  // Helper function to safely format currency
  const formatCurrency = (amount, currency_code) => {
    // Check if amount is valid
    if (amount == null || typeof amount !== 'number' || isNaN(amount)) {
      return '—';
    }
    
    // If moneyFormatter is available and money_format_settings is complete, use it
    try {
      const result = moneyFormatter({ amount, currency_code });
      // Verify the result is a valid string
      if (result && typeof result === 'string' && !result.includes('undefined') && !result.includes('NaN')) {
        return result;
      }
    } catch (error) {
      // If there's an error, fall back to simple formatting
    }
    
    // Fallback: simple currency formatting
    const symbol = money_format_settings?.currency_symbol || '';
    const formatted = amount.toFixed(2);
    return money_format_settings?.currency_position === 'before' 
      ? `${symbol} ${formatted}`
      : `${formatted} ${symbol}`;
  };

  const invoiceColumns = [
    { title: translate('Invoice #'), dataIndex: 'number' },
    {
      title: translate('Job'),
      dataIndex: ['job', 'jobId'],
    },
    {
      title: translate('Customer'),
      dataIndex: ['job', 'customer'],
    },
    {
      title: translate('Total'),
      dataIndex: 'total',
      onCell: () => ({ style: { textAlign: 'right', whiteSpace: 'nowrap', direction: 'ltr' } }),
      render: (total, record) => {
        const currency = record?.currency || money_format_settings?.default_currency_code || 'INR';
        return formatCurrency(total, currency);
      },
    },
    {
      title: translate('Status'),
      dataIndex: 'status',
      render: (status) => {
        const colors = { Draft: 'orange', Issued: 'blue', 'Partially Paid': 'purple', Paid: 'green', Overdue: 'red' };
        return <span style={{ color: colors[status] || '#000', fontWeight: 600 }}>{status}</span>;
      },
    },
  ];

  const quoteColumns = [
    { title: translate('Quote #'), dataIndex: 'quoteNumber' },
    { title: translate('Customer'), dataIndex: 'customerName' },
    { title: translate('Site'), dataIndex: 'siteAddress', ellipsis: true },
    {
      title: translate('Total'),
      dataIndex: 'totalAmount',
      onCell: () => ({ style: { textAlign: 'right', whiteSpace: 'nowrap', direction: 'ltr' } }),
      render: (total) => {
        const currency = money_format_settings?.default_currency_code || 'INR';
        return formatCurrency(total, currency);
      },
    },
    {
      title: translate('Status'),
      dataIndex: 'status',
      render: (status) => {
        const colors = { Draft: 'orange', Sent: 'blue', Accepted: 'green', Rejected: 'red' };
        return <span style={{ color: colors[status] || '#000', fontWeight: 600 }}>{status}</span>;
      },
    },
  ];

  const handleDateFilterChange = (value) => {
    if (value === 'custom') {
      setDateFilter((prev) => ({ ...prev, type: 'custom' }));
    } else {
      setDateFilter({ type: value, startDate: null, endDate: null });
    }
  };

  const onRangeChange = (dates) => {
    if (dates) {
      setDateFilter({ type: 'custom', startDate: dates[0], endDate: dates[1] });
    }
  };

  if (!money_format_settings) return null;

  const isAnyLoading = invoiceLoading || quoteLoading || paymentLoading || jobLoading;

  return (
    <div className="dashboard-page">
      {/* ── Toolbar ── */}
      <div className="whiteBox shadow pad15 dashboard-toolbar">
        <Row align="middle" justify="space-between" gutter={[16, 12]} wrap className="dashboard-row">
          <Col xs={24} lg={14}>
            <Row align="middle" gutter={[12, 12]} wrap>
              <Col>
                <strong>{translate('Filter by Date')}:</strong>
              </Col>
              <Col>
                <Select
                  defaultValue="thisMonth"
                  style={{ width: 160, maxWidth: '100%' }}
                  onChange={handleDateFilterChange}
                  options={[
                    { value: 'today', label: translate('Today') },
                    { value: 'thisWeek', label: translate('This week') },
                    { value: 'thisMonth', label: translate('This month') },
                    { value: 'custom', label: translate('Custom range') },
                  ]}
                />
              </Col>
              {dateFilter.type === 'custom' && (
                <Col xs={24} sm="auto">
                  <RangePicker onChange={onRangeChange} style={{ width: '100%' }} />
                </Col>
              )}
            </Row>
          </Col>

          <Col xs={24} lg={10} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Row align="middle" gutter={[12, 8]} justify="end" wrap>
              {lastUpdated && (
                <Col>
                  <Tooltip title={`Last refreshed: ${lastUpdated.format('HH:mm:ss')}`}>
                    <span
                      style={{
                        color: '#8c8c8c',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <ClockCircleOutlined />
                      {translate('Updated')} {lastUpdated.fromNow()}
                    </span>
                  </Tooltip>
                </Col>
              )}
              <Col>
                <Badge dot={isAnyLoading} color="blue">
                  <Button
                    icon={<ReloadOutlined spin={refreshing || isAnyLoading} />}
                    onClick={handleManualRefresh}
                    loading={refreshing}
                    size="small"
                  >
                    {translate('Refresh')}
                  </Button>
                </Badge>
              </Col>
            </Row>
          </Col>
        </Row>
      </div>

      {/* ── Financial ── */}
      <Title level={4} className="dashboard-section-title">
        {translate('Financial Data')}
      </Title>
      <Row gutter={[24, 24]} className="dashboard-row">
        <SummaryCard
          title={translate('Revenue Received')}
          prefix={translate('Total')}
          isLoading={paymentLoading}
          data={paymentResult?.total}
        />
        <SummaryCard
          title={translate('Outstanding Invoices')}
          prefix={translate('Unpaid')}
          isLoading={invoiceLoading}
          data={invoiceResult?.totalUnpaid}
        />
        <SummaryCard
          title={translate('Overdue Count')}
          prefix={translate('Invoices')}
          isLoading={invoiceLoading}
          data={invoiceResult?.overdueInvoicesCount}
          isMoney={false}
        />
        <SummaryCard
          title={translate('Overdue Value')}
          prefix={translate('Total')}
          isLoading={invoiceLoading}
          data={invoiceResult?.overdueInvoicesValue}
        />
      </Row>

      <div className="space30"></div>

      {/* ── Commercial ── */}
      <Title level={4} className="dashboard-section-title">
        {translate('Commercial Data')}
      </Title>
      <Row gutter={[24, 24]} className="dashboard-row">
        <SummaryCard
          title={translate('Sales Pipeline')}
          prefix={translate('Quotes')}
          isLoading={quoteLoading}
          data={quoteResult?.pipelineValue}
          colProps={{ lg: 12, xl: 12 }}
        />
        <SummaryCard
          title={translate('Quotes Issued')}
          prefix={translate('Total')}
          isLoading={quoteLoading}
          data={quoteResult?.total}
          colProps={{ lg: 12, xl: 12 }}
        />
      </Row>

      <div className="space30"></div>

      {/* ── Operational ── */}
      <Title level={4} className="dashboard-section-title">
        {translate('Operational Data')}
      </Title>
      <Row gutter={[24, 24]} className="dashboard-row">
        <SummaryCard
          title={translate('Jobs in Progress')}
          prefix={translate('Active')}
          isLoading={jobLoading}
          data={jobResult?.activeJobsCount}
          isMoney={false}
          colProps={{ lg: 8, xl: 6 }}
        />
      </Row>
      <div className="space15"></div>
      <Row gutter={[16, 16]}>
        {jobResult?.stageCounts &&
          Object.entries(jobResult.stageCounts).map(([stage, count]) => (
            <Col key={stage} xs={12} sm={8} md={6} lg={3}>
              <div
                className="whiteBox shadow pad10"
                style={{ textAlign: 'center', borderRadius: '8px' }}
              >
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>
                  {stage.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#22075e' }}>{count}</div>
              </div>
            </Col>
          ))}
      </Row>

      <div className="space30"></div>

      {/* ── Preview Cards ── */}
      <Row gutter={[32, 32]}>
        <Col className="gutter-row w-full" sm={{ span: 24 }} md={{ span: 24 }} lg={{ span: 18 }}>
          <div className="whiteBox shadow" style={{ height: 458 }}>
            <Row className="pad20" gutter={[0, 0]}>
              <PreviewCard
                title={translate('Invoices')}
                isLoading={invoiceLoading}
                entity="invoice"
                statistics={
                  !invoiceLoading &&
                  invoiceResult?.invoiceStatusSummary?.map((item) => ({
                    tag: item?.status,
                    color: 'blue',
                    value: Math.round((item?.count / (invoiceResult?.totalCount || 1)) * 100),
                  }))
                }
              />
              <PreviewCard
                title={translate('Quotes')}
                isLoading={quoteLoading}
                entity="quote"
                statistics={
                  !quoteLoading &&
                  quoteResult?.performance?.map((item) => ({
                    tag: item?.status,
                    color: 'blue',
                    value: item?.percentage,
                  }))
                }
              />
            </Row>
          </div>
        </Col>
        <Col className="gutter-row w-full" sm={{ span: 24 }} md={{ span: 24 }} lg={{ span: 6 }}>
          <CustomerPreviewCard
            isLoading={clientLoading}
            activeCustomer={clientResult?.active}
            newCustomer={clientResult?.new}
          />
        </Col>
      </Row>

      <div className="space30"></div>

      {/* ── Recent Tables ── */}
      <Row gutter={[32, 32]}>
        <Col className="gutter-row w-full" sm={{ span: 24 }} lg={{ span: 12 }}>
          <div className="whiteBox shadow pad20" style={{ height: '100%' }}>
            <h3 style={{ color: '#22075e', marginBottom: 5, padding: '0 20px 20px' }}>
              {translate('Recent Invoices')}
            </h3>
            <RecentTable entity={'invoice'} dataTableColumns={invoiceColumns} />
          </div>
        </Col>
        <Col className="gutter-row w-full" sm={{ span: 24 }} lg={{ span: 12 }}>
          <div className="whiteBox shadow pad20" style={{ height: '100%' }}>
            <h3 style={{ color: '#22075e', marginBottom: 5, padding: '0 20px 20px' }}>
              {translate('Recent Quotes')}
            </h3>
            <RecentTable entity={'quote'} dataTableColumns={quoteColumns} />
          </div>
        </Col>
      </Row>
    </div>
  );
}
