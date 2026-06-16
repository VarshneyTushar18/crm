import { Tag, Divider, Row, Col, Spin, Tooltip } from 'antd';
import { useMoney } from '@/settings';
import { selectMoneyFormat } from '@/redux/settings/selectors';
import { useSelector } from 'react-redux';

export default function AnalyticSummaryCard({
  title,
  tagColor,
  data,
  prefix,
  isLoading = false,
  isMoney = true,
  colProps = {},
}) {
  const { moneyFormatter } = useMoney();
  const money_format_settings = useSelector(selectMoneyFormat);

  // Helper function to safely format currency
  const formatCurrencyValue = (value) => {
    // If not money format, just return the value
    if (!isMoney) {
      return value || '—';
    }

    // Check if value is valid
    if (value == null || (typeof value === 'number' && isNaN(value))) {
      value = 0;
    }

    const currencyCode = money_format_settings?.default_currency_code || 'INR';

    // Try to use moneyFormatter
    try {
      const result = moneyFormatter({
        amount: value,
        currency_code: currencyCode,
      });
      // Verify the result is valid
      if (result && typeof result === 'string' && !result.includes('undefined') && !result.includes('NaN')) {
        return result;
      }
    } catch (error) {
      // Fall back to simple formatting
    }

    // Fallback: simple currency formatting
    const symbol = money_format_settings?.currency_symbol || '';
    const formatted = (value || 0).toFixed(2);
    return money_format_settings?.currency_position === 'before'
      ? `${symbol} ${formatted}`
      : `${formatted} ${symbol}`;
  };

  return (
    <Col
      className="gutter-row"
      xs={{ span: 24 }}
      sm={{ span: 12 }}
      md={{ span: 12 }}
      lg={{ span: 6 }}
      {...colProps}
    >
      <div
        className="whiteBox shadow"
        style={{ color: '#595959', fontSize: 13, minHeight: '106px', height: '100%' }}
      >
        <div className="pad15 strong" style={{ textAlign: 'center', justifyContent: 'center' }}>
          <h3
            style={{
              color: '#22075e',
              fontSize: 'large',
              margin: '5px 0',
              textTransform: 'capitalize',
            }}
          >
            {title}
          </h3>
        </div>
        <Divider style={{ padding: 0, margin: 0 }}></Divider>
        <div className="pad15">
          <Row gutter={[0, 0]} justify="space-between" wrap={false}>
            <Col className="gutter-row" flex="85px" style={{ textAlign: 'left' }}>
              <div className="left" style={{ whiteSpace: 'nowrap' }}>
                {prefix}
              </div>
            </Col>
            <Divider
              style={{
                height: '100%',
                padding: '10px 0',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              type="vertical"
            ></Divider>
            <Col
              className="gutter-row"
              flex="auto"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {isLoading ? (
                <Spin />
              ) : (
                <Tooltip
                  title={data}
                  style={{
                    direction: 'ltr',
                  }}
                >
                  <Tag
                    color={tagColor}
                    style={{
                      margin: '0 auto',
                      justifyContent: 'center',
                      maxWidth: '110px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      direction: 'ltr',
                    }}
                  >
                    {formatCurrencyValue(data)}
                  </Tag>
                </Tooltip>
              )}
            </Col>
          </Row>
        </div>
      </div>
    </Col>
  );
}
