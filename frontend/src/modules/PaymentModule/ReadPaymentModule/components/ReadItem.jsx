import { useState, useEffect } from 'react';

import { Button, Row, Col, Descriptions, Statistic, Card, Divider, Typography } from 'antd';
import { PageHeader } from '@ant-design/pro-layout';
import {
  EditOutlined,
  FilePdfOutlined,
  CloseCircleOutlined,
  MailOutlined,
  ExportOutlined,
} from '@ant-design/icons';

import { useSelector, useDispatch } from 'react-redux';
import { erp } from '@/redux/erp/actions';
import useLanguage from '@/locale/useLanguage';

import { generate as uniqueId } from 'shortid';

import { selectCurrentItem } from '@/redux/erp/selectors';

import { DOWNLOAD_BASE_URL } from '@/config/serverApiConfig';
import { useMoney } from '@/settings';

import useMail from '@/hooks/useMail';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

export default function ReadItem({ config, selectedItem }) {
  const translate = useLanguage();
  const { entity, ENTITY_NAME } = config;
  const dispatch = useDispatch();

  const { moneyFormatter } = useMoney();
  const { send, isLoading: mailInProgress } = useMail({ entity });
  const navigate = useNavigate();

  const { result: currentResult } = useSelector(selectCurrentItem);

  const resetErp = {
    status: '',
    client: {
      name: '',
      email: '',
      phone: '',
      address: '',
    },
    subTotal: 0,
    taxTotal: 0,
    taxRate: 0,
    total: 0,
    credit: 0,
    number: 0,
    year: 0,
  };

  const [currentErp, setCurrentErp] = useState(selectedItem ?? resetErp);

  useEffect(() => {
    if (currentResult) {
      setCurrentErp(currentResult);
    }
  }, [currentResult]);

  return (
    <>
      <PageHeader
        onBack={() => {
          navigate(`/${entity.toLowerCase()}`);
        }}
        title={`${ENTITY_NAME} # ${currentErp.number}`}
        ghost={false}
        extra={[
          <Button
            key={`${uniqueId()}`}
            onClick={() => {
              navigate(`/${entity.toLowerCase()}`);
            }}
            icon={<CloseCircleOutlined />}
          >
            {translate('Close')}
          </Button>,
          <Button
            key={`${uniqueId()}`}
            onClick={() => {
              window.open(
                `${DOWNLOAD_BASE_URL}${entity}/${entity}-${currentErp._id}.pdf`,
                '_blank'
              );
            }}
            icon={<FilePdfOutlined />}
          >
            {translate('Download PDF')}
          </Button>,
          <Button
            key={`${uniqueId()}`}
            loading={mailInProgress}
            onClick={() => {
              send(currentErp._id);
            }}
            icon={<MailOutlined />}
          >
            {translate('Send by email')}
          </Button>,

          <Button
            key={`${uniqueId()}`}
            onClick={() => {
              dispatch(
                erp.currentAction({
                  actionType: 'update',
                  data: currentErp,
                })
              );
              navigate(`/${entity.toLowerCase()}/update/${currentErp._id}`);
            }}
            type="primary"
            icon={<EditOutlined />}
          >
            {translate('Edit')}
          </Button>,
        ]}
        style={{
          padding: '20px 0px',
        }}
      >
        <Row>
          <Statistic
            title={translate('Payment Amount')}
            value={moneyFormatter({
              amount: currentErp.amount,
              currency_code: currentErp.currency,
            })}
            style={{
              margin: '0 32px',
            }}
          />
          <Statistic
            title={translate('Date')}
            value={dayjs(currentErp.date).format('DD/MM/YYYY')}
            style={{
              margin: '0 32px',
            }}
          />
          <Statistic
            title={translate('Payment Mode')}
            value={currentErp.paymentMode?.name || 'N/A'}
            style={{
              margin: '0 32px',
            }}
          />
        </Row>
      </PageHeader>
      
      <Divider dashed />
      
      <Descriptions title={translate('Entity Details')} bordered>
        <Descriptions.Item label={translate('Customer')} span={3}>
          {currentErp.invoice?.job?.customer || 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label={translate('Job ID')}>
          {currentErp.invoice?.job?.jobId || 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label={translate('Invoice Number')}>
          {currentErp.invoice?.number || 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label={translate('Reference Number')}>
          {currentErp.ref || 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label={translate('Description')} span={3}>
          {currentErp.description || 'N/A'}
        </Descriptions.Item>
      </Descriptions>
      
      <Divider />
      
      <Typography.Title level={5}>{translate('Financial Reconciliation')}</Typography.Title>
      <Row gutter={[24, 24]}>
        <Col span={12}>
          <Card size="small" title={translate('Invoice Summary')}>
            <Descriptions column={1}>
              <Descriptions.Item label={translate('Total Amount')}>
                {moneyFormatter({ amount: currentErp.invoice?.total, currency_code: currentErp.currency })}
              </Descriptions.Item>
              <Descriptions.Item label={translate('Total Paid')}>
                {moneyFormatter({ amount: currentErp.invoice?.amountPaid, currency_code: currentErp.currency })}
              </Descriptions.Item>
              <Descriptions.Item label={translate('Amount Due')}>
                {moneyFormatter({ amount: currentErp.invoice?.amountDue, currency_code: currentErp.currency })}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
           <div style={{ textAlign: 'right' }}>
             <Button 
                icon={<ExportOutlined />} 
                onClick={() => navigate(`/admin/invoice/read/${currentErp.invoice?._id}`)}
              >
                {translate('Go to Invoice')}
              </Button>
           </div>
        </Col>
      </Row>
    </>
  );
}
