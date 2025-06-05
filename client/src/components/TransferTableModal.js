import React, { useState, useEffect } from "react";
import { Modal, Select, Button, message } from "antd";
import axios from "axios";

const { Option } = Select;

const TransferTableModal = ({ visible, onCancel, tableId, currentWaiterName, onTransferSuccess }) => {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Вземи текущия userId
  const userData = localStorage.getItem("auth") ? JSON.parse(localStorage.getItem("auth")) : null;
  const currentUserId = userData?.userId;

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get("/api/users/get-users");
        // Филтрирай текущия потребител
        const otherUsers = res.data.filter(u => u.userId !== currentUserId);
        setUsers(otherUsers);
      } catch (error) {
        message.error("Грешка при зареждане на потребителите!");
      }
    };
    if (visible) {
      fetchUsers();
      setSelectedUserId(null);
    }
  }, [visible, currentUserId]);

  const handleTransfer = async () => {
    if (!selectedUserId) {
      message.error("Моля, изберете нов сервитьор!");
      return;
    }
    setLoading(true);
    try {
      await axios.put("/api/tables/transfer-table", {
        tableId,
        newUserId: selectedUserId
      });
      message.success("Масата е прехвърлена успешно!");
      setLoading(false);
      onTransferSuccess && onTransferSuccess();
      onCancel();
    } catch (error) {
      setLoading(false);
      message.error("Грешка при прехвърляне на масата!");
    }
  };

  return (
    <Modal
      title={`Прехвърляне на маса към друг сервитьор`}
      visible={visible}
      onCancel={onCancel}
      footer={[
        <Button key="back" onClick={onCancel}>Отказ</Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleTransfer} disabled={!selectedUserId}>
          Прехвърли
        </Button>,
      ]}
      width={400}
    >
      <div style={{ marginBottom: 20 }}>
        <b>Текущ сервитьор:</b> {currentWaiterName || currentUserId}
      </div>
      <Select
        placeholder="Изберете нов сервитьор"
        style={{ width: '100%' }}
        onChange={value => setSelectedUserId(value)}
        value={selectedUserId}
      >
        {users.map(user => (
          <Option key={user.userId} value={user.userId}>
            {user.name} ({user.userId})
          </Option>
        ))}
      </Select>
    </Modal>
  );
};

export default TransferTableModal; 