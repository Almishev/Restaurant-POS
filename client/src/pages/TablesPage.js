import React, { useState, useEffect } from "react";
import DefaultLayout from "../components/DefaultLayout";
import { Button, Modal, Form, Input, message } from "antd";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/OrderPage.css";

const TablesPage = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [kioskNumber, setKioskNumber] = useState("");
  const [kioskOrder, setKioskOrder] = useState(null);
  const [kioskMessage, setKioskMessage] = useState("");
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/tables/get-tables");
      setTables(res.data);
    } catch (error) {
      message.error("Грешка при зареждане на масите!");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    const refresh = () => fetchTables();
    window.addEventListener("pos-tables-changed", refresh);
    return () => window.removeEventListener("pos-tables-changed", refresh);
  }, []);

  const user = localStorage.getItem("auth") ? JSON.parse(localStorage.getItem("auth")) : null;
  const myTables = user ? tables.filter((t) => t.createdBy === user.userId) : [];

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const onFinish = async (values) => {
    try {
      const auth = localStorage.getItem("auth") ? JSON.parse(localStorage.getItem("auth")) : null;
      await axios.post("/api/tables/add-table", { ...values, createdBy: auth ? auth.userId : "" });
      message.success("Масата е добавена успешно!");
      setIsModalVisible(false);
      form.resetFields();
      fetchTables();
    } catch (error) {
      message.error("Грешка при добавяне на маса!");
    }
  };

  const markKioskOrder = async (event) => {
    event.preventDefault();
    const orderNumber = kioskNumber.trim();
    if (!orderNumber) return;
    try {
      const res = await axios.post("/api/kitchen/mark-cashier", { orderNumber });
      setKioskOrder(res.data.order);
      setKioskMessage(res.data.message);
      if (res.data.already) message.warning(res.data.message);
      else message.success(res.data.message);
    } catch (error) {
      setKioskOrder(null);
      const text = error.response?.data?.message || "Няма поръчка с този номер.";
      setKioskMessage(text);
      message.error(text);
    }
  };

  const openTable = (record) => {
    localStorage.setItem("selectedTable", JSON.stringify(record));
    navigate(`/order/${record._id}`);
  };

  return (
    <DefaultLayout>
      <form
        onSubmit={markKioskOrder}
        style={{
          marginBottom: 20,
          padding: 16,
          border: "1px solid #d9d9d9",
          borderRadius: 8,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        <label style={{ flex: "1 1 220px" }}>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Номер от киоск</div>
          <Input
            size="large"
            value={kioskNumber}
            onChange={(event) => setKioskNumber(event.target.value)}
            inputMode="numeric"
          />
        </label>
        <Button type="primary" htmlType="submit" size="large" style={{ minHeight: 44 }}>
          Маркирай
        </Button>
        {kioskMessage && (
          <div style={{ flex: "1 1 100%", color: kioskOrder?.atCashier ? "#1f4d3a" : "#8d2b2b" }}>
            {kioskMessage}
          </div>
        )}
        {kioskOrder && (
          <ul style={{ flex: "1 1 100%", margin: 0, paddingLeft: 18 }}>
            {(kioskOrder.items || []).map((item, index) => (
              <li key={`${item.name}-${index}`}>
                {item.name} × {item.quantity}
              </li>
            ))}
          </ul>
        )}
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Моите маси</h1>
        <Button type="primary" onClick={showModal} style={{ minHeight: 44 }}>
          Добави маса
        </Button>
      </div>

      {loading ? (
        <p style={{ marginTop: 24 }}>Зареждане...</p>
      ) : myTables.length === 0 ? (
        <p style={{ marginTop: 24, color: "#888" }}>Нямате маси. Добавете нова маса.</p>
      ) : (
        <div className="tables-touch-grid">
          {myTables.map((t) => (
            <button
              key={t._id}
              type="button"
              className="table-touch-card"
              onClick={() => openTable(t)}
            >
              <span className="table-name">{t.name}</span>
              <span className="table-hint">Докосни за поръчка</span>
            </button>
          ))}
        </div>
      )}

      <Modal
        title="Добави нова маса"
        visible={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width="90%"
        style={{ maxWidth: 420 }}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Име на маса" rules={[{ required: true, message: "Въведи име!" }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" style={{ minHeight: 48 }}>
              Запази
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </DefaultLayout>
  );
};

export default TablesPage;
