import { Empty, Spin } from 'antd';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts';

const COLORS = [
  '#1677ff',
  '#52c41a',
  '#fa8c16',
  '#722ed1',
  '#eb2f96',
  '#13c2c2',
  '#faad14',
  '#ff4d4f',
  '#2f54eb',
  '#a0d911',
];

const ChartShell = ({ loading, empty, height = 280, children }) => {
  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (empty) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data for this period" />
      </div>
    );
  }
  return <div style={{ width: '100%', height }}>{children}</div>;
};

const formatTooltipValue = (value, isMoney) => {
  if (value == null) return '0';
  if (isMoney) {
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  return value;
};

export function DashboardBarChart({
  data = [],
  loading,
  dataKey = 'count',
  labelKey = 'label',
  color = '#1677ff',
  isMoney = false,
}) {
  const chartData = data.map((row) => ({
    name: row[labelKey] || row.label || row.status || row.key,
    value: Number(row[dataKey] ?? row.count ?? row.value ?? 0),
  }));

  return (
    <ChartShell loading={loading} empty={!chartData.length}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => formatTooltipValue(v, isMoney)} />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} name={isMoney ? 'Amount' : 'Count'} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function DashboardPieChart({ data = [], loading, dataKey = 'count', labelKey = 'label' }) {
  const chartData = data
    .map((row, index) => ({
      name: row[labelKey] || row.label || row.status || row.key,
      value: Number(row[dataKey] ?? row.count ?? row.value ?? 0),
      color: COLORS[index % COLORS.length],
    }))
    .filter((row) => row.value > 0);

  return (
    <ChartShell loading={loading} empty={!chartData.length}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={95}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={{ strokeWidth: 1 }}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function DashboardAreaChart({
  series = [],
  loading,
  valueKey = 'count',
  color = '#1677ff',
  isMoney = false,
  name = 'Count',
}) {
  const chartData = series.map((row) => ({
    name: row.label || row.key,
    value: Number(row[valueKey] ?? row.count ?? row.value ?? 0),
  }));

  return (
    <ChartShell loading={loading} empty={!chartData.length}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => formatTooltipValue(v, isMoney)} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={`url(#gradient-${color})`}
            name={name}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function DashboardMultiLineChart({ series = [], loading, lines = [] }) {
  const keys = new Set();
  series.forEach((row) => keys.add(row.key));
  const chartData = (series[0]?.series || []).map((point, index) => {
    const row = { name: point.label || point.key };
    lines.forEach((line) => {
      const source = series.find((s) => s.key === line.key);
      row[line.key] = Number(source?.series?.[index]?.count ?? 0);
    });
    return row;
  });

  return (
    <ChartShell loading={loading} empty={!chartData.length}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Legend />
          {lines.map((line, index) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color || COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              name={line.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
