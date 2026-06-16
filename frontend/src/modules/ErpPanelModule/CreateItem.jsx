import { useState, useEffect } from "react";

import { Button, Tag, Form, Divider } from "antd";
import { PageHeader } from "@ant-design/pro-layout";

import { useSelector, useDispatch } from "react-redux";

import useLanguage from "@/locale/useLanguage";

import { settingsAction } from "@/redux/settings/actions";
import { erp } from "@/redux/erp/actions";
import { selectCreatedItem } from "@/redux/erp/selectors";

import calculate from "@/utils/calculate";
import { generate as uniqueId } from "shortid";

import Loading from "@/components/Loading";
import { ArrowLeftOutlined, CloseCircleOutlined, PlusOutlined } from "@ant-design/icons";

import { useNavigate } from "react-router-dom";

function joinPath(...parts) {
  return (
    "/" +
    parts
      .filter(Boolean)
      .map((p) => String(p).replace(/^\/+|\/+$/g, ""))
      .join("/")
  );
}

function SaveForm({ form }) {
  const translate = useLanguage();
  const handelClick = () => form.submit();

  return (
    <Button onClick={handelClick} type="primary" icon={<PlusOutlined />}>
      {translate("Save")}
    </Button>
  );
}

export default function CreateItem({ config, CreateForm }) {
  const translate = useLanguage();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // ✅ GUARD: config missing => prevent crash (blank page)
  if (!config) {
    return (
      <div style={{ padding: 16 }}>
        <b>Create config missing.</b>
        <div style={{ marginTop: 8 }}>
          Fix: pass <code>config</code> with at least <code>{`{ entity: "invoice", basePath: "/admin" }`}</code>
        </div>
      </div>
    );
  }

  const { entity, basePath = "/admin" } = config;
  const entityLower = String(entity || "").toLowerCase();

  useEffect(() => {
    dispatch(settingsAction.list({ entity: "setting" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { isLoading, isSuccess, result } = useSelector(selectCreatedItem);
  const [form] = Form.useForm();
  const [subTotal, setSubTotal] = useState(0);
  const [offerSubTotal, setOfferSubTotal] = useState(0);

  const handelValuesChange = (changedValues, values) => {
    const items = values["items"];
    let subTotalLocal = 0;
    let subOfferTotalLocal = 0;

    if (items) {
      items.forEach((item) => {
        if (!item) return;

        if (item.offerPrice && item.quantity) {
          const offerTotal = calculate.multiply(item["quantity"], item["offerPrice"]);
          subOfferTotalLocal = calculate.add(subOfferTotalLocal, offerTotal);
        }

        if (item.quantity && item.price) {
          const total = calculate.multiply(item["quantity"], item["price"]);
          subTotalLocal = calculate.add(subTotalLocal, total);
        }
      });

      setSubTotal(subTotalLocal);
      setOfferSubTotal(subOfferTotalLocal);
    }
  };

  useEffect(() => {
    if (isSuccess && result?._id) {
      form.resetFields();
      dispatch(erp.resetAction({ actionType: "create" }));
      setSubTotal(0);
      setOfferSubTotal(0);

      // ✅ FIX: route should be /admin/invoice/read/:id (not /invoice/read/:id)
      navigate(joinPath(basePath, entityLower, "read", result._id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const onSubmit = (fieldsValue) => {
    if (fieldsValue?.items) {
      const newList = [...fieldsValue.items].map((item) => ({
        ...item,
        total: calculate.multiply(item.quantity, item.price),
      }));
      fieldsValue = { ...fieldsValue, items: newList };
    }

    dispatch(erp.create({ entity: entityLower, jsonData: fieldsValue }));
  };

  const goBackToList = () => navigate(joinPath(basePath, entityLower));

  return (
    <>
      <PageHeader
        onBack={goBackToList}
        backIcon={<ArrowLeftOutlined />}
        title={translate("New")}
        ghost={false}
        tags={<Tag>{translate("Draft")}</Tag>}
        extra={[
          <Button key={`${uniqueId()}`} onClick={goBackToList} icon={<CloseCircleOutlined />}>
            {translate("Cancel")}
          </Button>,
          <SaveForm form={form} key={`${uniqueId()}`} />,
        ]}
        style={{ padding: "20px 0px" }}
      />

      <Divider dashed />

      <Loading isLoading={isLoading}>
        <Form form={form} layout="vertical" onFinish={onSubmit} onValuesChange={handelValuesChange}>
          {/* ✅ GUARD for CreateForm */}
          {CreateForm ? (
            <CreateForm subTotal={subTotal} offerTotal={offerSubTotal} />
          ) : (
            <div style={{ padding: 12 }}>
              <b>CreateForm missing.</b> Please pass <code>CreateForm</code> prop.
            </div>
          )}
        </Form>
      </Loading>
    </>
  );
}