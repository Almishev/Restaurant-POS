import React, { useState, useEffect, useRef, useCallback } from "react";
import { Table, Card, Tag, Spin, Empty, Button, Tabs, message } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ReactToPrint from "react-to-print";

/**
 * Shared Kitchen / Bar station board:
 * - Active (not done) with Готово
 * - Issued (done) with Върни
 */
const StationOrdersPage = ({
  title,
  department,
  printTitle,
  printFooter,
}) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const printRefs = useRef({});
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("selectedTable");
    navigate("/login", { replace: true });
  };

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/kitchen/orders");
      const data = await response.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      message.error("Грешка при зареждане на поръчките");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 5000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  const buildGrouped = (wantDone) => {
    const grouped = {};
    orders.forEach((order) => {
      const table = order.tableName;
      (order.items || [])
        .filter(
          (item) =>
            !!item.done === wantDone && item.department === department
        )
        .forEach((item) => {
          const key = `${table}__${item.name}__${wantDone ? "d" : "a"}`;
          if (!grouped[key]) {
            grouped[key] = {
              table,
              name: item.name,
              quantity: 0,
              orderIds: [],
              note: item.note || "",
              waiterName: order.waiterName || "-",
            };
          }
          grouped[key].quantity += item.quantity;
          grouped[key].orderIds.push({
            orderId: order._id,
            itemName: item.name,
          });
          if (item.note && grouped[key].note.indexOf(item.note) === -1) {
            grouped[key].note = grouped[key].note
              ? `${grouped[key].note}; ${item.note}`
              : item.note;
          }
        });
    });
    return Object.values(grouped).map((g, idx) => ({ ...g, key: idx }));
  };

  const activeData = buildGrouped(false);
  const issuedData = buildGrouped(true);

  const handleItemDone = async (orderId, itemName) => {
    try {
      await fetch(`/api/kitchen/orders/${orderId}/done`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName }),
      });
      await fetchOrders();
    } catch {
      message.error("Грешка при отбелязване като готово");
    }
  };

  const handleItemUndone = async (orderId, itemName) => {
    try {
      await fetch(`/api/kitchen/orders/${orderId}/undone`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName }),
      });
      message.success("Поръчката е върната като неиздадена");
      await fetchOrders();
    } catch {
      message.error("Грешка при Върни");
    }
  };

  const makeColumns = (mode) => [
    {
      title: "Маса",
      dataIndex: "table",
      align: "center",
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    { title: "Артикул", dataIndex: "name", align: "center" },
    { title: "Количество", dataIndex: "quantity", align: "center" },
    { title: "Сервитьор", dataIndex: "waiterName", align: "center" },
    {
      title: "Забележка",
      dataIndex: "note",
      align: "center",
      render: (note) =>
        note ? <span style={{ color: "#ff4d4f" }}>{note}</span> : "-",
    },
    {
      title: "Действие",
      key: "action",
      align: "center",
      render: (_, record) => (
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {mode === "active" ? (
            <Button
              type="primary"
              style={{ background: "#52c41a", borderColor: "#52c41a" }}
              onClick={() =>
                handleItemDone(record.orderIds[0].orderId, record.name)
              }
            >
              Готово
            </Button>
          ) : (
            <Button
              onClick={() =>
                handleItemUndone(record.orderIds[0].orderId, record.name)
              }
            >
              Върни
            </Button>
          )}
          {mode === "active" && (
            <ReactToPrint
              trigger={() => <Button type="primary">Печат</Button>}
              content={() => printRefs.current[record.key]}
            />
          )}
        </div>
      ),
    },
  ];

  const PrintOrder = React.forwardRef(({ record }, ref) => (
    <div ref={ref} style={{ padding: 24, fontSize: 18 }}>
      <h2 style={{ textAlign: "center", marginBottom: 16 }}>{printTitle}</h2>
      <div>
        <b>Маса:</b> {record.table}
      </div>
      <div>
        <b>Артикул:</b> {record.name}
      </div>
      <div>
        <b>Количество:</b> {record.quantity}
      </div>
      {record.note && (
        <div>
          <b>Забележка:</b> {record.note}
        </div>
      )}
      <div style={{ marginTop: 16, fontSize: 14, color: "#888" }}>
        {printFooter}
      </div>
    </div>
  ));

  const renderTable = (dataSource, mode) =>
    dataSource.length === 0 ? (
      <Empty
        description={
          mode === "active"
            ? "Няма чакащи поръчки."
            : "Няма издадени поръчки."
        }
      />
    ) : (
      <>
        <Table
          dataSource={dataSource}
          columns={makeColumns(mode)}
          pagination={false}
          bordered
          style={{ background: "white" }}
        />
        {mode === "active" &&
          dataSource.map((record) => (
            <div
              style={{ position: "absolute", left: -9999, top: 0 }}
              key={`print-${record.key}`}
            >
              <PrintOrder
                ref={(el) => {
                  printRefs.current[record.key] = el;
                }}
                record={record}
              />
            </div>
          ))}
      </>
    );

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button danger icon={<LogoutOutlined />} onClick={handleLogout} size="large">
          Изход
        </Button>
      </div>
      <Card title={title} bordered={false} style={{ boxShadow: "0 2px 8px #f0f1f2" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Tabs activeKey={tab} onChange={setTab}>
            <Tabs.TabPane tab={`Активни (${activeData.length})`} key="active">
              {renderTable(activeData, "active")}
            </Tabs.TabPane>
            <Tabs.TabPane tab={`Издадени (${issuedData.length})`} key="issued">
              {renderTable(issuedData, "issued")}
            </Tabs.TabPane>
          </Tabs>
        )}
      </Card>
    </div>
  );
};

export default StationOrdersPage;
