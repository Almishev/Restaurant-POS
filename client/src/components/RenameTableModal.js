import React, { useEffect, useState } from "react";
import { Modal, Input, Button, message } from "antd";
import axios from "axios";

const RenameTableModal = ({
  visible,
  onCancel,
  tableId,
  currentName,
  onRenamed,
}) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(currentName || "");
    }
  }, [visible, currentName]);

  const handleRename = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      message.error("Въведете име на масата!");
      return;
    }
    if (trimmed === currentName) {
      onCancel();
      return;
    }

    setLoading(true);
    try {
      const res = await axios.put("/api/tables/rename-table", {
        tableId,
        name: trimmed,
      });
      message.success("Името на масата е променено!");
      onRenamed?.(res.data.table);
      onCancel();
    } catch (error) {
      message.error(
        error.response?.data?.message || "Грешка при преименуване на масата!"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Смяна на име на маса"
      visible={visible}
      onCancel={onCancel}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 12 }}>
          <Button onClick={onCancel}>Отказ</Button>
          <Button type="primary" loading={loading} onClick={handleRename}>
            Запази
          </Button>
        </div>
      }
      width="95%"
      style={{ maxWidth: 400 }}
    >
      <div style={{ marginBottom: 8 }}>
        <b>Текущо име:</b> {currentName}
      </div>
      <Input
        size="large"
        placeholder="Ново име"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onPressEnter={handleRename}
        autoFocus
      />
    </Modal>
  );
};

export default RenameTableModal;
