import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Row,
  Col,
  Select,
  DatePicker,
  Typography,
  Button,
  Tooltip,
  Badge,
  Segmented,
  Table,
  Tag,
  Progress,
  Empty,
  Spin,
} from 'antd';
import { ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useLanguage from '@/locale/useLanguage';
import { useMoney } from '@/settings';
import { request } from '@/request';
import useOnFetch from '@/hooks/useOnFetch';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getAdminDashboardOverview } from '@/api/extensionApi';

dayjs.extend(relativeTime);

import RecentTable from './components/RecentTable';
import SummaryCard from './components/SummaryCard';
import PreviewCard from './components/PreviewCard';
import CustomerPreviewCard from './components/CustomerPreviewCard';
import {
  DashboardAreaChart,
  DashboardBarChart,
  DashboardPieChart,
} from './components/DashboardCharts';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';

import { selectMoneyFormat } from '@/redux/settings/selectors';
import { useSelector } from 'react-redux';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const POLLING_INTERVAL_MS = 30_000;

function BarList({ items = [], loading, valueKey = 'count', labelKey = 'label', color = '#1677ff' }) {
  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (!items.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />;
  }
  const max = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {items.map((item) => {
        const value = Number(item[valueKey] || 0);
        return (
          <div key={item.key || item.label || item.status}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 13 }}>{item[labelKey] || item.status}</Text>
              <Text strong>{value}</Text>
            </div>
            <div style={{ height: 8, background: '#f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.round((value / max) * 100)}%`,
                  height: '100%',
                  background: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardModule() {
  const translate = useLanguage();
  const navigate = useNavigate();
  const { moneyFormatter } = useMoney();
  const money_format_settings = useSelector(selectMoneyFormat);

  const [dateFilter, setDateFilter] = useState({
    type: 'thisMonth',
    startDate: null,
    endDate: null,
  });

  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('numbers');
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
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

  const { result: clientResult, isLoading: clientLoading, onFetch: fetchClientStats } = useOnFetch();

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const params = {
        type: dateFilter.type,
        ...(dateFilter.startDate && {
          startDate: dateFilter.startDate.format('YYYY-MM-DD'),
        }),
        ...(dateFilter.endDate && {
          endDate: dateFilter.endDate.format('YYYY-MM-DD'),
        }),
      };
      const data = await getAdminDashboardOverview(params);
      setOverview(data);
    } catch {
      setOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [dateFilter]);

  const fetchAll = useCallback(() => {
    fetchOverview();

    const currency = money_format_settings?.default_currency_code || null;
    if (!currency) {
      setLastUpdated(dayjs());
      return;
    }

    const params = {
      currency,
      type: dateFilter.type,
      startDate: dateFilter.startDate,
      endDate: dateFilter.endDate,
    };

    fetchInvoicesStats(getStatsData({ entity: 'invoice', ...params }));
    fetchQuotesStats(getStatsData({ entity: 'quote', ...params }));
    fetchPayemntsStats(getStatsData({ entity: 'payment', ...params }));
    fetchClientStats(request.summary({ entity: 'client' }));
    fetchOverview();
    setLastUpdated(dayjs());
  }, [money_format_settings?.default_currency_code, dateFilter, fetchOverview]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  const formatCurrency = (amount, currency_code) => {
    if (amount == null || typeof amount !== 'number' || isNaN(amount)) {
      return '—';
    }
    try {
      const result = moneyFormatter({ amount, currency_code });
      if (result && typeof result === 'string' && !result.includes('undefined') && !result.includes('NaN')) {
        return result;
      }
    } catch {
      // fallback below
    }
    const symbol = money_format_settings?.currency_symbol || '';
    const formatted = amount.toFixed(2);
    return money_format_settings?.currency_position === 'before'
      ? `${symbol} ${formatted}`
      : `${formatted} ${symbol}`;
  };

  const invoiceColumns = [
    { title: translate('Invoice #'), dataIndex: 'number' },
    { title: translate('Job'), dataIndex: ['job', 'jobId'] },
    { title: translate('Customer'), dataIndex: ['job', 'customer'] },
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
      render: (total) => formatCurrency(total, money_format_settings?.default_currency_code || 'INR'),
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

  const ops = overview?.operations || {};
  const commercial = overview?.commercial || {};
  const financial = overview?.financial || {};
  const recent = overview?.recent || {};
  const analytics = overview?.analytics || {};
  const currency = money_format_settings?.default_currency_code || 'INR';

  const isAnyLoading = overviewLoading || invoiceLoading || quoteLoading || paymentLoading;

  const leadChartItems = Object.entries(commercial.leadsByStatus || {}).map(([key, count]) => ({
    key,
    label: key,
    count,
  }));

  const quoteChartItems = (commercial.quotesByStatus || []).map((row) => ({
    key: row.status,
    label: row.status,
    count: row.count,
  }));

  const pipelineTrendData = (analytics.jobsTrend?.series || []).map((point, index) => ({
    name: point.label,
    jobs: analytics.jobsTrend?.series?.[index]?.count || 0,
    leads: analytics.leadsTrend?.series?.[index]?.count || 0,
    quotes: analytics.quotesTrend?.series?.[index]?.count || 0,
  }));

  const invoiceChartData =
    !invoiceLoading && invoiceResult?.invoiceStatusSummary
      ? invoiceResult.invoiceStatusSummary.map((item) => ({
          label: item?.status,
          count: item?.count || 0,
        }))
      : [];

  const quotePerformanceData =
    !quoteLoading && quoteResult?.performance
      ? quoteResult.performance.map((item) => ({
          label: item?.status,
          count: item?.count || 0,
        }))
      : [];

  const scheduleColumns = [
    {
      title: 'Time',
      dataIndex: 'startTime',
      render: (v) => (v ? dayjs(v).format('HH:mm') : '—'),
      width: 70,
    },
    { title: 'Assignment', dataIndex: 'title', ellipsis: true },
    { title: 'Job', dataIndex: 'jobCode', width: 110 },
    { title: 'Assignee', dataIndex: 'assigneeName', width: 120, render: (v) => v || '—' },
    { title: 'Role', dataIndex: 'role', width: 100 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (s) => <Tag>{s}</Tag>,
    },
  ];

  const recentJobColumns = [
    { title: 'Job', dataIndex: 'jobId', width: 120 },
    { title: 'Customer', dataIndex: 'customer', ellipsis: true },
    {
      title: 'Stage',
      dataIndex: 'currentWorkflowLabel',
      ellipsis: true,
    },
    {
      title: 'Progress',
      dataIndex: 'completionPercent',
      width: 120,
      render: (v) => <Progress percent={Number(v || 0)} size="small" />,
    },
    {
      title: 'State',
      dataIndex: 'systemState',
      width: 90,
      render: (v, row) => (
        <Tag color={row.onHold ? 'orange' : v === 'Active' ? 'processing' : 'default'}>
          {row.onHold ? 'On Hold' : v || 'New'}
        </Tag>
      ),
    },
    {
      title: '',
      width: 80,
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => navigate(`/admin/job/${row._id}`)}>
          Open
        </Button>
      ),
    },
  ];

  const reviewColumns = [
    { title: 'Module', dataIndex: 'moduleLabel', ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (s) => <Tag color="orange">{s}</Tag>,
    },
    { title: 'Title', dataIndex: 'title', ellipsis: true },
    {
      title: '',
      width: 80,
      render: (_, row) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/admin/site-engineer?jobId=${row.jobId}`)}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="whiteBox shadow pad15 dashboard-toolbar">
        <Row align="middle" justify="space-between" gutter={[16, 12]} wrap className="dashboard-row">
          <Col xs={24} lg={14}>
            <Row align="middle" gutter={[12, 12]} wrap>
              <Col>
                <strong>{translate('Filter by Date')}:</strong>
              </Col>
              <Col>
                <Select
                  value={dateFilter.type}
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
                    <span style={{ color: '#8c8c8c', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ClockCircleOutlined />
                      {translate('Updated')} {lastUpdated.fromNow()}
                    </span>
                  </Tooltip>
                </Col>
              )}
              <Col>
                <Segmented
                  value={viewMode}
                  onChange={setViewMode}
                  options={[
                    { label: translate('Numbers'), value: 'numbers' },
                    { label: translate('Graph'), value: 'graph' },
                  ]}
                />
              </Col>
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

      <Title level={4} className="dashboard-section-title">
        Operations — live project status
      </Title>
      <Row gutter={[24, 24]} className="dashboard-row">
        <SummaryCard
          title="Active Jobs"
          prefix="Projects"
          isLoading={overviewLoading}
          data={ops.activeJobs}
          isMoney={false}
        />
        <SummaryCard
          title="Avg Workflow Progress"
          prefix="All jobs"
          isLoading={overviewLoading}
          data={ops.avgProgressPercent}
          isMoney={false}
        />
        <SummaryCard
          title="SE Reviews Open"
          prefix="Pending"
          isLoading={overviewLoading}
          data={ops.awaitingSiteEngineerReviews}
          isMoney={false}
        />
        <SummaryCard
          title="Jobs On Hold"
          prefix="Flagged"
          isLoading={overviewLoading}
          data={ops.onHoldJobs}
          isMoney={false}
        />
        <SummaryCard
          title="Fabrication Avg"
          prefix="Shop drawings"
          isLoading={overviewLoading}
          data={ops.fabrication?.avgProgressPercent}
          isMoney={false}
        />
        <SummaryCard
          title="Today's Schedule"
          prefix="Assignments"
          isLoading={overviewLoading}
          data={ops.todaySchedule?.length || 0}
          isMoney={false}
        />
      </Row>

      <div className="space30" />

      {viewMode === 'numbers' ? (
        <>
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <div className="whiteBox shadow pad20" style={{ height: '100%' }}>
                <Title level={5} style={{ marginTop: 0 }}>
                  Jobs by current workflow stage
                </Title>
                <BarList items={ops.workflowStages} loading={overviewLoading} color="#1677ff" />
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className="whiteBox shadow pad20" style={{ height: '100%' }}>
                <Title level={5} style={{ marginTop: 0 }}>
                  Open Site Engineer reviews by module
                </Title>
                <BarList items={ops.seReviewsByModule} loading={overviewLoading} color="#fa8c16" />
              </div>
            </Col>
          </Row>

          <div className="space30" />

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={14}>
              <div className="whiteBox shadow pad20">
                <Title level={5} style={{ marginTop: 0 }}>
                  Today's schedule
                </Title>
                <Table
                  size="small"
                  rowKey="_id"
                  loading={overviewLoading}
                  columns={scheduleColumns}
                  dataSource={ops.todaySchedule || []}
                  pagination={false}
                  locale={{ emptyText: 'No assignments scheduled for today' }}
                  scroll={{ x: 'max-content' }}
                />
              </div>
            </Col>
            <Col xs={24} lg={10}>
              <div className="whiteBox shadow pad20">
                <Title level={5} style={{ marginTop: 0 }}>
                  Operations alerts
                </Title>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div className="whiteBox pad15" style={{ background: '#fafafa' }}>
                    <Text type="secondary">Material lines delayed</Text>
                    <div style={{ fontSize: 22, fontWeight: 600 }}>{ops.materialLinesDelayed ?? 0}</div>
                  </div>
                  <div className="whiteBox pad15" style={{ background: '#fafafa' }}>
                    <Text type="secondary">Open purchase orders</Text>
                    <div style={{ fontSize: 22, fontWeight: 600 }}>{ops.procurementOpen ?? 0}</div>
                  </div>
                  <div className="whiteBox pad15" style={{ background: '#fafafa' }}>
                    <Text type="secondary">Stages awaiting Site Engineer</Text>
                    <div style={{ fontSize: 22, fontWeight: 600 }}>{ops.awaitingSEStages ?? 0}</div>
                  </div>
                  <div className="whiteBox pad15" style={{ background: '#fafafa' }}>
                    <Text type="secondary">Fabrication jobs in progress</Text>
                    <div style={{ fontSize: 22, fontWeight: 600 }}>{ops.fabrication?.jobsInProgress ?? 0}</div>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </>
      ) : (
        <>
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={14}>
              <div className="whiteBox shadow pad20">
                <Title level={5} style={{ marginTop: 0 }}>
                  Revenue trend ({analytics.period?.granularity === 'week' ? 'weekly' : 'daily'})
                </Title>
                <DashboardAreaChart
                  series={analytics.revenueTrend?.series || []}
                  loading={overviewLoading}
                  valueKey="value"
                  color="#52c41a"
                  isMoney
                  name="Revenue"
                />
              </div>
            </Col>
            <Col xs={24} lg={10}>
              <div className="whiteBox shadow pad20">
                <Title level={5} style={{ marginTop: 0 }}>
                  Job status breakdown
                </Title>
                <DashboardPieChart
                  data={analytics.jobStateBreakdown || []}
                  loading={overviewLoading}
                />
              </div>
            </Col>
          </Row>

          <div className="space30" />

          <Row gutter={[24, 24]}>
            <Col xs={24}>
              <div className="whiteBox shadow pad20">
                <Title level={5} style={{ marginTop: 0 }}>
                  Pipeline activity — jobs, leads & quotes
                </Title>
                {overviewLoading || !pipelineTrendData.length ? (
                  <DashboardAreaChart series={[]} loading={overviewLoading} />
                ) : (
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                      <LineChart data={pipelineTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="jobs" stroke="#1677ff" strokeWidth={2} name="Jobs" />
                        <Line type="monotone" dataKey="leads" stroke="#52c41a" strokeWidth={2} name="Leads" />
                        <Line type="monotone" dataKey="quotes" stroke="#722ed1" strokeWidth={2} name="Quotes" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </Col>
          </Row>

          <div className="space30" />

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <div className="whiteBox shadow pad20">
                <Title level={5} style={{ marginTop: 0 }}>
                  Workflow stage distribution
                </Title>
                <DashboardBarChart
                  data={ops.workflowStages}
                  loading={overviewLoading}
                  color="#1677ff"
                />
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className="whiteBox shadow pad20">
                <Title level={5} style={{ marginTop: 0 }}>
                  SE backlog by module
                </Title>
                <DashboardBarChart
                  data={ops.seReviewsByModule}
                  loading={overviewLoading}
                  color="#fa8c16"
                />
              </div>
            </Col>
          </Row>

          <div className="space30" />

          <Row gutter={[32, 32]}>
            <Col xs={24} lg={12}>
              <div className="whiteBox shadow pad20">
                <Title level={5} style={{ marginTop: 0 }}>
                  Lead pipeline
                </Title>
                <DashboardBarChart data={leadChartItems} loading={overviewLoading} color="#52c41a" />
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className="whiteBox shadow pad20">
                <Title level={5} style={{ marginTop: 0 }}>
                  Quote value by status
                </Title>
                <DashboardBarChart
                  data={analytics.quoteValueByStatus || quoteChartItems}
                  loading={overviewLoading}
                  dataKey="value"
                  color="#722ed1"
                  isMoney
                />
              </div>
            </Col>
          </Row>

          <div className="space30" />

          <Row gutter={[32, 32]}>
            <Col xs={24} lg={12}>
              <div className="whiteBox shadow pad20">
                <Title level={5} style={{ marginTop: 0 }}>
                  Invoice status distribution
                </Title>
                <DashboardPieChart data={invoiceChartData} loading={invoiceLoading} />
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className="whiteBox shadow pad20">
                <Title level={5} style={{ marginTop: 0 }}>
                  Quote performance (period)
                </Title>
                <DashboardPieChart data={quotePerformanceData} loading={quoteLoading} />
              </div>
            </Col>
          </Row>

          <div className="space30" />

          <Row gutter={[32, 32]}>
            <Col className="gutter-row w-full" sm={{ span: 24 }} md={{ span: 24 }} lg={{ span: 18 }}>
              <div className="whiteBox shadow" style={{ minHeight: 420 }}>
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
        </>
      )}

      <div className="space30" />

      <Title level={4} className="dashboard-section-title">
        Commercial
      </Title>
      <Row gutter={[24, 24]} className="dashboard-row">
        <SummaryCard
          title="New Leads"
          prefix="Pipeline"
          isLoading={overviewLoading}
          data={commercial.leadsByStatus?.New}
          isMoney={false}
        />
        <SummaryCard
          title="Quoted Leads"
          prefix="In progress"
          isLoading={overviewLoading}
          data={commercial.leadsByStatus?.Quoted}
          isMoney={false}
        />
        <SummaryCard
          title="Quote Pipeline"
          prefix="Draft + Sent"
          isLoading={overviewLoading}
          data={commercial.pipelineValue}
        />
        <SummaryCard
          title="Accepted — No Job"
          prefix="Conversion gap"
          isLoading={overviewLoading}
          data={commercial.acceptedQuotesWithoutJob}
          isMoney={false}
        />
      </Row>

      <div className="space30" />

      <Title level={4} className="dashboard-section-title">
        {translate('Financial Data')}
      </Title>
      <Row gutter={[24, 24]} className="dashboard-row">
        <SummaryCard
          title={translate('Revenue Received')}
          prefix={translate('Period')}
          isLoading={overviewLoading}
          data={financial.revenueCollected ?? paymentResult?.total}
        />
        <SummaryCard
          title="Active Contract Value"
          prefix="Jobs"
          isLoading={overviewLoading}
          data={financial.contractValueActive}
        />
        <SummaryCard
          title={translate('Outstanding Invoices')}
          prefix={translate('Unpaid')}
          isLoading={overviewLoading}
          data={financial.outstandingInvoices ?? invoiceResult?.totalUnpaid}
        />
        <SummaryCard
          title={translate('Overdue Value')}
          prefix={translate('Total')}
          isLoading={overviewLoading}
          data={financial.overdueValue ?? invoiceResult?.overdueInvoicesValue}
        />
      </Row>

      <div className="space30" />

      <Row gutter={[32, 32]}>
        <Col xs={24} lg={12}>
          <div className="whiteBox shadow pad20">
            <Title level={5} style={{ marginTop: 0 }}>
              Recent job updates
            </Title>
            <Table
              size="small"
              rowKey="_id"
              loading={overviewLoading}
              columns={recentJobColumns}
              dataSource={recent.jobs || []}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="whiteBox shadow pad20">
            <Title level={5} style={{ marginTop: 0 }}>
              Open Site Engineer reviews
            </Title>
            <Table
              size="small"
              rowKey="_id"
              loading={overviewLoading}
              columns={reviewColumns}
              dataSource={recent.openReviews || []}
              pagination={false}
              locale={{ emptyText: 'No open reviews' }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </Col>
      </Row>

      <div className="space30" />

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
