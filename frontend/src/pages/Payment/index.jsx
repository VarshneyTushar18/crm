import dayjs from 'dayjs';
import useLanguage from '@/locale/useLanguage';
import PaymentDataTableModule from '@/modules/PaymentModule/PaymentDataTableModule';

import { useDate } from '@/settings';

export default function Payment() {
  const translate = useLanguage();
  const { dateFormat } = useDate();
  const searchConfig = {
    entity: 'invoice',
    displayLabels: ['number'],
    searchFields: 'number',
    outputValue: '_id',
  };

  const deleteModalLabels = ['number'];
  const dataTableColumns = [
    {
      title: translate('Number'),
      dataIndex: 'number',
    },
    {
      title: translate('Customer'),
      dataIndex: ['invoice', 'job', 'customer'],
      render: (value) => value || '—',
    },
    {
      title: translate('Amount'),
      dataIndex: 'amount',
      onCell: () => {
        return {
          style: {
            textAlign: 'right',
            whiteSpace: 'nowrap',
            direction: 'ltr',
          },
        };
      },
      render: (amount, record) => {
        const value = Number(amount);
        if (!Number.isFinite(value)) return '—';
        return `$${value.toFixed(2)} ${record.currency || ''}`.trim();
      },
    },
    {
      title: translate('Date'),
      dataIndex: 'date',
      render: (date) => {
        return date ? dayjs(date).format(dateFormat) : '—';
      },
    },
    {
      title: translate('Invoice'),
      dataIndex: ['invoice', 'number'],
      render: (value) => value || '—',
    },
    {
      title: translate('Payment Mode'),
      dataIndex: ['paymentMode', 'name'],
      render: (value) => value || '—',
    },
  ];

  const entity = 'payment';

  const Labels = {
    PANEL_TITLE: translate('payment'),
    DATATABLE_TITLE: translate('Payments'),
    ADD_NEW_ENTITY: translate('add_new_payment'),
    ENTITY_NAME: translate('payment'),
  };

  const configPage = {
    entity,
    ...Labels,
  };
  const config = {
    ...configPage,
    disableAdd: true,
    dataTableColumns,
    searchConfig,
    deleteModalLabels,
    basePath: '/admin',
  };
  return <PaymentDataTableModule config={config} />;
}
