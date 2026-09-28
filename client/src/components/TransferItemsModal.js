import React, { useState, useEffect } from "react";
import { Modal, Select, Button, Table, message, Checkbox, InputNumber } from "antd";
import axios from "axios";
import { formatPrice } from "../utils/formatPrice";
import { mergeLineItems } from "../utils/mergeLineItems";

const { Option } = Select;

const itemKey = (item) => `${item._id}-${item.source}`;

const TransferItemsModal = ({ visible, onCancel, currentTableId, currentTableName }) => {
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const userData = localStorage.getItem("auth") ? JSON.parse(localStorage.getItem("auth")) : null;
        const userId = userData?.userId;
        const res = await axios.get("/api/tables/get-tables");
        const otherTables = res.data.filter(
          (table) => table._id !== currentTableId && table.createdBy === userId
        );
        setTables(otherTables);
      } catch (error) {
        message.error("Грешка при зареждане на масите!");
      }
    };

    if (visible) {
      setSelectedTableId(null);
      setSelectedItems([]);
      fetchTables();
      fetchCurrentTableItems();
    }
  }, [visible, currentTableId]);

  const fetchCurrentTableItems = async () => {
    try {
      const res = await axios.get("/api/tables/get-tables");
      const currentTable = res.data.find((table) => table._id === currentTableId);
      if (currentTable) {
        const pending = mergeLineItems(currentTable.pendingItems || []).map((item) => ({
          ...item,
          source: "pending",
        }));
        const cart = mergeLineItems(currentTable.cartItems || []).map((item) => ({
          ...item,
          source: "cart",
        }));
        setCartItems([...pending, ...cart]);
      }
    } catch (error) {
      message.error("Грешка при зареждане на артикулите!");
    }
  };

  const getSelected = (record) =>
    selectedItems.find((item) => item._id === record._id && item.source === record.source);

  const handleItemSelect = (record, checked) => {
    if (!checked) {
      setSelectedItems((prev) =>
        prev.filter((item) => !(item._id === record._id && item.source === record.source))
      );
      return;
    }
    // Default: transfer 1 portion (not the full line quantity)
    setSelectedItems((prev) => [
      ...prev.filter((item) => !(item._id === record._id && item.source === record.source)),
      { ...record, transferQty: 1 },
    ]);
  };

  const handleTransferQtyChange = (record, value) => {
    const maxQty = Number(record.quantity) || 1;
    const qty = Math.min(maxQty, Math.max(1, Number(value) || 1));
    setSelectedItems((prev) => {
      const exists = prev.some((item) => item._id === record._id && item.source === record.source);
      if (!exists) {
        return [...prev, { ...record, transferQty: qty }];
      }
      return prev.map((item) =>
        item._id === record._id && item.source === record.source
          ? { ...item, transferQty: qty }
          : item
      );
    });
  };

  const handleTransfer = async () => {
    if (!selectedTableId) {
      message.error("Моля, изберете маса!");
      return;
    }

    if (selectedItems.length === 0) {
      message.error("Моля, изберете артикули за прехвърляне!");
      return;
    }

    setLoading(true);
    try {
      // Send explicit transferQuantity so server never moves the full line by mistake
      const withQty = selectedItems.map(({ source, transferQty, ...item }) => {
        const available = Number(item.quantity) || 1;
        const move = Math.min(available, Math.max(1, Number(transferQty) || 1));
        return {
          ...item,
          source,
          transferQuantity: move,
          quantity: move,
        };
      });

      const pendingPayload = withQty
        .filter((item) => item.source === "pending")
        .map(({ source, ...item }) => item);
      const cartPayload = withQty
        .filter((item) => item.source === "cart")
        .map(({ source, ...item }) => item);

      await axios.post("/api/tables/transfer-items", {
        fromTableId: currentTableId,
        toTableId: selectedTableId,
        pendingItems: pendingPayload,
        cartItems: cartPayload,
      });

      message.success("Артикулите са прехвърлени успешно!");
      onCancel();
    } catch (error) {
      console.error("Грешка при прехвърляне:", error);
      message.error("Грешка при прехвърляне на артикули!");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Избери",
      key: "select",
      width: 70,
      render: (_, record) => (
        <Checkbox
          checked={!!getSelected(record)}
          onChange={(e) => handleItemSelect(record, e.target.checked)}
        />
      ),
    },
    { title: "Артикул", dataIndex: "name" },
    { title: "Цена", dataIndex: "price", render: (price) => formatPrice(price) },
    {
      title: "На масата",
      dataIndex: "quantity",
      width: 90,
    },
    {
      title: "Прехвърли бр.",
      key: "transferQty",
      width: 130,
      render: (_, record) => {
        const selected = getSelected(record);
        const maxQty = Number(record.quantity) || 1;
        return (
          <InputNumber
            min={1}
            max={maxQty}
            value={selected ? selected.transferQty : 1}
            disabled={!selected}
            onChange={(v) => handleTransferQtyChange(record, v)}
            style={{ width: 90 }}
          />
        );
      },
    },
    {
      title: "Статус",
      render: (_, record) => {
        if (record.source === "pending") return "В количката";
        if (record.status === "Готово") return "Готово";
        return "Изпратено";
      },
    },
  ];

  return (
    <Modal
      title={`Прехвърляне на артикули от маса ${currentTableName}`}
      visible={visible}
      onCancel={onCancel}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 12 }}>
          <Button key="back" onClick={onCancel}>
            Отказ
          </Button>
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={handleTransfer}
            disabled={!selectedTableId || selectedItems.length === 0}
          >
            Прехвърли
          </Button>
        </div>
      }
      width="95%"
      style={{ maxWidth: 900 }}
    >
      <div style={{ marginBottom: 20 }}>
        <Select
          placeholder="Изберете маса за прехвърляне"
          style={{ width: "100%", maxWidth: 400 }}
          value={selectedTableId}
          onChange={(value) => setSelectedTableId(value)}
        >
          {tables.map((table) => (
            <Option key={table._id} value={table._id}>
              {table.name}
            </Option>
          ))}
        </Select>
      </div>

      <Table
        columns={columns}
        dataSource={cartItems}
        rowKey={itemKey}
        pagination={false}
        size="small"
      />
    </Modal>
  );
};

export default TransferItemsModal;
