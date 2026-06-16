import { useEffect } from "react";
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  RedoOutlined,
  PlusOutlined,
  EllipsisOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import { Dropdown, Table, Button, message } from "antd";
import { PageHeader } from "@ant-design/pro-layout";

import AutoCompleteAsync from "@/components/AutoCompleteAsync";
import { useSelector, useDispatch } from "react-redux";
import useLanguage from "@/locale/useLanguage";
import { erp } from "@/redux/erp/actions";
import { selectListItems } from "@/redux/erp/selectors";
import { useErpContext } from "@/context/erp";
import { API_BASE_URL } from "../../config/serverApiConfig";
import { useNavigate } from "react-router-dom";

function joinPath(...parts) {
  return parts
    .filter(Boolean)
    .map((p) => String(p).replace(/^\/+|\/+$/g, ""))
    .join("/")
    .replace(/^/, "/");
}

function AddNewItem({ config }) {
  const navigate = useNavigate();
  if (!config) return null;

  const { ADD_NEW_ENTITY, entity, basePath = "" } = config;

  const handleClick = () => {
    const e = String(entity || "").toLowerCase();
    navigate(joinPath(basePath, e, "create"));
  };

  return (
    <Button onClick={handleClick} type="primary" icon={<PlusOutlined />}>
      {ADD_NEW_ENTITY}
    </Button>
  );
}

// ✅ download helper (token + backend endpoint)
async function downloadPdfFromApi({ entity, id, filename }) {
  const token = localStorage.getItem("token");
  const url = `${API_BASE_URL}/${entity}/download/${id}`;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "Download failed");
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || `${entity}-${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.URL.revokeObjectURL(blobUrl);
}

export default function DataTable({ config, extra = [] }) {
  const translate = useLanguage();

  if (!config) {
    return (
      <div style={{ padding: 16 }}>
        <b>ERP Module config missing.</b>
        <div style={{ marginTop: 8 }}>
          Fix: pass <code>config</code> into the module or set a fallback config.
        </div>
      </div>
    );
  }

  const {
    entity,
    dataTableColumns: initialColumns = [],
    disableAdd = false,
    searchConfig,
    basePath = "/admin",
    DATATABLE_TITLE,
  } = config;

  const e = String(entity || "").toLowerCase();

  const { result: listResult, isLoading: listIsLoading } = useSelector(selectListItems);
  const { pagination = {}, items: dataSource = [] } = listResult || {};

  const { erpContextAction } = useErpContext();
  const { modal } = erpContextAction;

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const menuItems = [
    { label: translate("Show"), key: "read", icon: <EyeOutlined /> },
    { label: translate("Edit"), key: "edit", icon: <EditOutlined /> },
    { label: translate("Download"), key: "download", icon: <FilePdfOutlined /> },
    ...extra,
    { type: "divider" },
    { label: translate("Delete"), key: "delete", icon: <DeleteOutlined /> },
  ];

  const handleRead = (record) => {
    dispatch(erp.currentItem({ data: record }));
    navigate(joinPath(basePath, e, "read", record._id));
  };

  const handleEdit = (record) => {
    dispatch(erp.currentAction({ actionType: "update", data: { ...record } }));
    navigate(joinPath(basePath, e, "update", record._id));
  };

  const handleDownload = async (record) => {
    try {
      const filename =
        e === "quote"
          ? `Quote-${record?.quoteNumber || record?._id}.pdf`
          : `${e}-${record?._id}.pdf`;

      await downloadPdfFromApi({ entity: e, id: record._id, filename });
      message.success("Download started");
    } catch (err) {
      message.error(err?.message || "Download failed");
    }
  };

  const handleDelete = (record) => {
    dispatch(erp.currentAction({ actionType: "delete", data: record }));
    modal.open();
  };

  const handleRecordPayment = (record) => {
    dispatch(erp.currentItem({ data: record }));
    navigate(joinPath(basePath, "invoice", "record-payment", record._id));
  };

  let dataTableColumns = Array.isArray(initialColumns) ? [...initialColumns] : [];

  dataTableColumns = [
    ...dataTableColumns,
    {
      title: "",
      key: "action",
      fixed: "right",
      render: (_, record) => (
        <Dropdown
          menu={{
            items: menuItems,
            onClick: async ({ key }) => {
              switch (key) {
                case "read":
                  handleRead(record);
                  break;
                case "edit":
                  handleEdit(record);
                  break;
                case "download":
                  await handleDownload(record);
                  break;
                case "delete":
                  handleDelete(record);
                  break;
                case "recordPayment":
                  handleRecordPayment(record);
                  break;
                default:
                  break;
              }
            },
          }}
          trigger={["click"]}
        >
          <EllipsisOutlined
            style={{ cursor: "pointer", fontSize: "24px" }}
            onClick={(ev) => ev.preventDefault()}
          />
        </Dropdown>
      ),
    },
  ];

  const handelDataTableLoad = (paginationObj) => {
    const options = {
      page: paginationObj?.current || 1,
      items: paginationObj?.pageSize || 10,
    };
    dispatch(erp.list({ entity: e, options }));
  };

  const dispatcher = () => {
    const options = { page: 1, items: 10 };
    dispatch(erp.list({ entity: e, options }));
  };

  useEffect(() => {
    dispatcher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterTable = (value, option) => {
    try {
      // clear
      if (!value && !option) {
        dispatch(erp.list({ entity: e, options: { page: 1, items: 10 } }));
        return;
      }

      const equal =
        typeof value === "string"
          ? value
          : value?.value || value?._id || value?.name || option?.value || "";

      if (!equal) {
        dispatch(erp.list({ entity: e, options: { page: 1, items: 10 } }));
        return;
      }

      dispatch(
        erp.list({
          entity: e,
          options: {
            equal: String(equal),
            filter: searchConfig?.entity,
            page: 1,
            items: 10,
          },
        })
      );
    } catch (err) {
      console.error("filterTable error:", err);
      dispatch(erp.list({ entity: e, options: { page: 1, items: 10 } }));
    }
  };

  return (
    <>
      <PageHeader
        title={DATATABLE_TITLE}
        ghost={true}
        onBack={() => window.history.back()}
        backIcon={<ArrowLeftOutlined />}
        extra={[
          <AutoCompleteAsync
            key="erp-search"
            entity={searchConfig?.entity}
            displayLabels={["name"]}
            searchFields={"name"}
            onChange={filterTable}
          />,
          <Button onClick={dispatcher} key="erp-refresh" icon={<RedoOutlined />}>
            {translate("Refresh")}
          </Button>,
          !disableAdd && <AddNewItem config={config} key="erp-add" />,
        ]}
        style={{ padding: "20px 0px" }}
      />

      <Table
        columns={dataTableColumns}
        rowKey={(item) => item._id}
        dataSource={dataSource}
        pagination={pagination}
        loading={listIsLoading}
        onChange={handelDataTableLoad}
        scroll={{ x: true }}
      />
    </>
  );
}