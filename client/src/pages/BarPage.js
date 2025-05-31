import React, { useState, useEffect, useRef } from "react";
import { Table, Card, Tag, Spin, Empty, Button } from "antd";
import ReactToPrint from "react-to-print";

// Компонент за бележката
const BarPrintOrder = React.forwardRef(({ record }, ref) => (
  <div ref={ref} style={{ padding: 24, fontSize: 18 }}>
    <h2 style={{ textAlign: 'center', marginBottom: 16 }}>БАР</h2>
    <div><b>Маса:</b> {record.table}</div>
    <div><b>Артикул:</b> {record.name}</div>
    <div><b>Количество:</b> {record.quantity}</div>
    <div style={{ marginTop: 16, fontSize: 14, color: '#888' }}>--- Наздраве! ---</div>
  </div>
));

const BarPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const printRefs = useRef({});

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

  // Групирай всички бар артикули по маса и име, само ако done: false
  const grouped = {};
  orders.forEach((order) => {
    const table = order.tableName;
    order.items.filter(item => !item.done && item.department === 'bar').forEach((item) => {
      const key = table + "__" + item.name;
      if (!grouped[key]) {
        grouped[key] = {
          table,
          name: item.name,
          quantity: 0,
          orderIds: [],
        };
      }
      grouped[key].quantity += item.quantity;
      grouped[key].orderIds.push({ orderId: order._id, itemName: item.name });
    });
  });
  const dataSource = Object.values(grouped).map((g, idx) => ({ ...g, key: idx }));

  // Отбележи артикул като готов (done)
  const handleItemDone = async (orderId, itemName) => {
    try {
      await fetch(`/api/kitchen/orders/${orderId}/done`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName }),
      });
      // Презареди поръчките
      const response = await fetch("/api/kitchen/orders");
      const data = await response.json();
      setOrders(data);
    } catch {
      // Може да добавиш съобщение за грешка
    }
  };

  const columns = [
    {
      title: "Маса",
      dataIndex: "table",
      key: "table",
      align: "center",
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "Артикул",
      dataIndex: "name",
      key: "name",
      align: "center",
    },
    {
      title: "Количество",
      dataIndex: "quantity",
      key: "quantity",
      align: "center",
    },
    {
      title: "Сервитьор",
      dataIndex: "waiterName",
      key: "waiterName",
      align: "center",
      render: (_, record) => {
        // Вземи името на сервитьора от първата orderId
        const order = orders.find(o => o._id === record.orderIds[0].orderId);
        return order && order.waiterName ? order.waiterName : "-";
      }
    },
    {
      title: "Действие",
      key: "action",
      align: "center",
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Button
            style={{ background: '#52c41a', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
            onClick={() => handleItemDone(record.orderIds[0].orderId, record.name)}
          >
            Готово
          </Button>
          <ReactToPrint
            trigger={() => (
              <Button style={{ background: '#1890ff', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px' }}>
                Печат
              </Button>
            )}
            content={() => printRefs.current[record.key]}
          />
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <Card title="Поръчки към бара" bordered={false} style={{ boxShadow: "0 2px 8px #f0f1f2" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : dataSource.length === 0 ? (
          <Empty description="Няма изпратени артикули към бара." />
        ) : (
          <>
            <Table
              dataSource={dataSource}
              columns={columns}
              pagination={false}
              bordered
              style={{ background: "white" }}
            />
            {/* Скрити компоненти за печат */}
            {dataSource.map(record => (
              <div style={{ position: 'absolute', left: -9999, top: 0 }} key={record.key}>
                <BarPrintOrder
                  ref={el => printRefs.current[record.key] = el}
                  record={record}
                />
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
};

export default BarPage; 