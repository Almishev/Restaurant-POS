import React, { useState, useEffect } from "react";
import { Table, Card, Tag, Spin, Empty } from "antd";

const KitchenPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/kitchen/orders");
        const data = await response.json();
        setOrders(data);
      } catch (error) {
        // Може да добавиш съобщение за грешка
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const handleOrderDone = async (orderId) => {
    try {
      await fetch(`/api/kitchen/orders/${orderId}`, { method: 'DELETE' });
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
    } catch {
      // Може да добавиш съобщение за грешка
    }
  };

  const columns = [
    {
      title: "Маса",
      dataIndex: "tableName",
      key: "tableName",
      align: "center",
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "Артикули",
      dataIndex: "items",
      key: "items",
      align: "center",
      render: (items) => (
        <ul style={{ paddingLeft: 16, textAlign: "left" }}>
          {items.map((item, idx) => (
            <li key={idx}>
              {item.name} <b>x{item.quantity}</b>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: "Време",
      dataIndex: "createdAt",
      key: "createdAt",
      align: "center",
      render: (createdAt) => new Date(createdAt).toLocaleString(),
    },
    {
      title: "Действие",
      key: "action",
      align: "center",
      render: (_, record) => (
        <button
          style={{ background: '#52c41a', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
          onClick={() => handleOrderDone(record._id)}
        >
          Готово
        </button>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <Card title="Поръчки към кухнята" bordered={false} style={{ boxShadow: "0 2px 8px #f0f1f2" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : orders.length === 0 ? (
          <Empty description="Няма изпратени поръчки към кухнята." />
        ) : (
          <Table
            dataSource={orders.map((order) => ({ ...order, key: order._id }))}
            columns={columns}
            pagination={false}
            bordered
            style={{ background: "white" }}
          />
        )}
      </Card>
    </div>
  );
};

export default KitchenPage; 