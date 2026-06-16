import { useEffect, useState } from "react";
import { Modal } from "antd";

import { useDispatch, useSelector } from "react-redux";
import { erp } from "@/redux/erp/actions";
import { useErpContext } from "@/context/erp";
import { selectDeletedItem } from "@/redux/erp/selectors";
import { valueByString } from "@/utils/helpers";

export default function Delete({ config }) {
  if (!config) return null;

  const { entity } = config;

  let {
    deleteModalLabels = [], // ✅ default empty array
    deleteMessage = "Do you want delete : ",
    modalTitle = "Remove Item",
  } = config;

  // ✅ extra safety (if someone passes string instead of array)
  if (!Array.isArray(deleteModalLabels)) deleteModalLabels = [];

  const dispatch = useDispatch();
  const { current, isLoading, isSuccess } = useSelector(selectDeletedItem);
  const { state, erpContextAction } = useErpContext();
  const { deleteModal } = state;
  const { modal } = erpContextAction;

  const [displayItem, setDisplayItem] = useState("");

  useEffect(() => {
    if (isSuccess) {
      modal.close();
      const options = { page: 1, items: 10 };
      dispatch(erp.list({ entity, options }));
    }

    if (current) {
      // ✅ if no labels provided, fallback to something meaningful
      const labels = deleteModalLabels.length
        ? deleteModalLabels.map((x) => valueByString(current, x)).join(" ")
        : current?.quoteNumber || current?.name || current?._id;

      setDisplayItem(labels || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, current]);

  const handleOk = () => {
    const id = current?._id;
    if (!id) return modal.close();

    dispatch(erp.delete({ entity, id }));
    modal.close();
  };

  const handleCancel = () => {
    if (!isLoading) modal.close();
  };

  return (
    <Modal
      title={modalTitle}
      open={deleteModal.isOpen}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={isLoading}
    >
      <p>
        {deleteMessage}
        {displayItem}
      </p>
    </Modal>
  );
}