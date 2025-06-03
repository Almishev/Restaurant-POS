import React, { useState, useEffect } from "react";
import { Modal, Select, Button, Table, message, Checkbox } from "antd";
import axios from "axios";

const { Option } = Select;

const TransferItemsModal = ({ visible, onCancel, currentTableId, currentTableName }) => {
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Зареждане на всички маси
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await axios.get("/api/tables/get-tables");
        // Филтрирай текущата маса от списъка
        const otherTables = res.data.filter(table => table._id !== currentTableId);
        setTables(otherTables);
      } catch (error) {
        message.error("Грешка при зареждане на масите!");
      }
    };

    if (visible) {
      fetchTables();
      fetchCurrentTableItems();
    }
  }, [visible, currentTableId]);

  // Зареждане на артикули от текущата маса
  const fetchCurrentTableItems = async () => {
    try {
      const res = await axios.get("/api/tables/get-tables");
      const currentTable = res.data.find(table => table._id === currentTableId);
      if (currentTable) {
        // Комбинирай pendingItems и cartItems за по-лесно боравене
        const allItems = [
          ...(currentTable.pendingItems || []).map(item => ({ ...item, source: 'pending' })),
          ...(currentTable.cartItems || []).map(item => ({ ...item, source: 'cart' }))
        ];
        setCartItems(allItems);
      }
    } catch (error) {
      message.error("Грешка при зареждане на артикулите!");
    }
  };

  // Избор на артикул за прехвърляне
  const handleItemSelect = (record) => {
    const isSelected = selectedItems.some(item => 
      item._id === record._id && item.source === record.source
    );
    
    if (isSelected) {
      setSelectedItems(selectedItems.filter(item => 
        !(item._id === record._id && item.source === record.source)
      ));
    } else {
      setSelectedItems([...selectedItems, record]);
    }
  };

  // Прехвърляне на избраните артикули
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
      // Групирай избраните артикули по източник (pending/cart)
      const pendingItems = selectedItems.filter(item => item.source === 'pending');
      const cartItems = selectedItems.filter(item => item.source === 'cart');

      // API заявка за прехвърляне на артикулите
      await axios.post("/api/tables/transfer-items", {
        fromTableId: currentTableId,
        toTableId: selectedTableId,
        pendingItems: pendingItems.map(({ source, ...item }) => item),
        cartItems: cartItems.map(({ source, ...item }) => item)
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

  // Колони за таблицата с артикули
  const columns = [
    {
      title: "Избери",
      key: "select",
      render: (_, record) => (
        <Checkbox 
          checked={selectedItems.some(item => 
            item._id === record._id && item.source === record.source
          )}
          onChange={() => handleItemSelect(record)}
        />
      ),
    },
    { title: "Артикул", dataIndex: "name" },
    { title: "Цена", dataIndex: "price" },
    { title: "Количество", dataIndex: "quantity" },
    { 
      title: "Статус", 
      render: (_, record) => {
        if (record.source === 'pending') return 'В количката';
        if (record.status === 'Готово') return 'Готово';
        return 'Изпратено';
      }
    },
  ];

  return (
    <Modal
      title={`Прехвърляне на артикули от маса ${currentTableName}`}
      visible={visible}
      onCancel={onCancel}
      footer={[
        <Button key="back" onClick={onCancel}>
          Отказ
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleTransfer}
          disabled={!selectedTableId || selectedItems.length === 0}
        >
          Прехвърли
        </Button>,
      ]}
      width={800}
    >
      <div style={{ marginBottom: 20 }}>
        <Select
          placeholder="Изберете маса за прехвърляне"
          style={{ width: 300 }}
          onChange={value => setSelectedTableId(value)}
        >
          {tables.map(table => (
            <Option key={table._id} value={table._id}>
              {table.name}
            </Option>
          ))}
        </Select>
      </div>

      <Table
        columns={columns}
        dataSource={cartItems}
        rowKey={record => `${record._id}-${record.source}`}
        pagination={false}
        size="small"
      />
    </Modal>
  );
};

export default TransferItemsModal;
