import { useState, useEffect } from 'react';

import { Button, Row, Col, Descriptions, Tag, Divider } from 'antd';
import { PageHeader } from '@ant-design/pro-layout';
import { FileTextOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { generate as uniqueId } from 'shortid';
import { useMoney, useDate } from '@/settings';
import { useNavigate } from 'react-router-dom';
import useLanguage from '@/locale/useLanguage';
import UpdatePayment from './UpdatePayment';
import { tagColor } from '@/utils/statusTagColor';

export default function Payment({ config, currentItem }) {
  const translate = useLanguage();
  const { entity, ENTITY_NAME } = config;

  const money = useMoney();
  const navigate = useNavigate();

  const [currentErp, setCurrentErp] = useState(currentItem);

  useEffect(() => {
    if (currentItem) {
      setCurrentErp(currentItem);
    }
  }, [currentItem]);

  return (
    <>
      <Row gutter={[12, 12]}>
        <Col
          className="gutter-row"
          xs={{ span: 24 }}
          sm={{ span: 24 }}
          md={{ span: 24 }}
          lg={{ span: 20, push: 2 }}
        >
          <PageHeader
            onBack={() => navigate(`/${entity.toLowerCase()}`)}
            title={`Update  ${ENTITY_NAME} # ${currentErp.number}`}
            ghost={false}
            extra={[
              <Button
                key={`${uniqueId()}`}
                onClick={() => {
                  navigate(`/${entity.toLowerCase()}`);
                }}
                icon={<CloseCircleOutlined />}
              >
                {translate('Cancel')}
              </Button>,
              <Button
                key={`${uniqueId()}`}
                onClick={() => navigate(`/admin/invoice/read/${currentErp.invoice?._id}`)}
                icon={<FileTextOutlined />}
              >
                {translate('Show invoice')}
              </Button>,
            ]}
            style={{
              padding: '20px 0px',
            }}
          ></PageHeader>
          <Divider dashed />
        </Col>
      </Row>
      <Row gutter={[12, 12]}>
        <Col
          className="gutter-row"
          xs={{ span: 24, order: 2 }}
          sm={{ span: 24, order: 2 }}
          md={{ span: 10, order: 2, push: 2 }}
          lg={{ span: 10, order: 2, push: 4 }}
        >
          <div className="space50"></div>
          <Descriptions title={`${translate('Customer')} : ${currentErp.invoice?.job?.customer}`} column={1}>
            <Descriptions.Item label={translate('Job ID')}>{currentErp.invoice?.job?.jobId}</Descriptions.Item>
            <Divider dashed />
            <Descriptions.Item label={translate('Invoice Status')}>
               <Tag color={tagColor(currentErp.invoice?.status)}>{currentErp.invoice?.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={translate('Invoice Amount')}>
              {money.moneyFormatter({
                amount: currentErp.invoice?.total,
                currency_code: currentErp.currency,
              })}
            </Descriptions.Item>
            <Descriptions.Item label={translate('Total Paid')}>
              {money.moneyFormatter({
                amount: currentErp.invoice?.amountPaid,
                currency_code: currentErp.currency,
              })}
            </Descriptions.Item>
            <Descriptions.Item label={translate('Amount Due')}>
              {money.moneyFormatter({
                amount: currentErp.invoice?.amountDue,
                currency_code: currentErp.currency,
              })}
            </Descriptions.Item>
          </Descriptions>
        </Col>

        <Col
          className="gutter-row"
          xs={{ span: 24, order: 1 }}
          sm={{ span: 24, order: 1 }}
          md={{ span: 12, order: 1 }}
          lg={{ span: 10, order: 1, push: 2 }}
        >
          <UpdatePayment config={config} currentPayment={currentErp} />
        </Col>
      </Row>
    </>
  );
}
