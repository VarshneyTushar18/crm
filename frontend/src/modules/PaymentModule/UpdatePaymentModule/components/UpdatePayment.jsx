import { useState, useEffect } from 'react';
import { Form, Button } from 'antd';
import dayjs from 'dayjs';
import { useSelector, useDispatch } from 'react-redux';
import { erp } from '@/redux/erp/actions';
import { selectUpdatedItem } from '@/redux/erp/selectors';

import useLanguage from '@/locale/useLanguage';

import Loading from '@/components/Loading';

import calculate from '@/utils/calculate';
import PaymentForm from '@/forms/PaymentForm';
import { useNavigate } from 'react-router-dom';

export default function UpdatePayment({ config, currentPayment }) {
  const translate = useLanguage();
  const navigate = useNavigate();
  let { entity } = config;
  const dispatch = useDispatch();

  const { isLoading, isSuccess } = useSelector(selectUpdatedItem);

  const [form] = Form.useForm();

  const [maxAmount, setMaxAmount] = useState(0);

  useEffect(() => {
    if (currentPayment) {
      const { invoice, amount } = currentPayment;
      
      if (invoice) {
        // Max this payment can be is (Current Amount Due + This payment's current amount)
        setMaxAmount(invoice.amountDue + amount);
      }

      const newValues = { ...currentPayment };
      if (newValues.date) {
        newValues.date = dayjs(newValues.date);
      }
      form.setFieldsValue(newValues);
    }
  }, [currentPayment]);

  useEffect(() => {
    if (isSuccess) {
      form.resetFields();
      dispatch(erp.resetAction({ actionType: 'recordPayment' }));
      dispatch(erp.list({ entity }));
      navigate(`/${entity.toLowerCase()}/read/${currentPayment._id}`);
    }
  }, [isSuccess]);

  const onSubmit = (fieldsValue) => {
    if (currentPayment) {
      const { invoice } = currentPayment;
      fieldsValue = {
        ...fieldsValue,
        invoice: invoice?._id,
      };
    }

    dispatch(
      erp.update({
        entity,
        id: currentPayment._id,
        jsonData: fieldsValue,
      })
    );
  };

  return (
    <>
      <Loading isLoading={isLoading}>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <PaymentForm maxAmount={maxAmount} />
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {translate('Update')}
            </Button>
          </Form.Item>
        </Form>
      </Loading>
    </>
  );
}
