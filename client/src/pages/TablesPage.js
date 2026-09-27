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

  const openTable = (record) => {
    localStorage.setItem("selectedTable", JSON.stringify(record));
    navigate(`/order/${record._id}`);
  };

  return (
    <DefaultLayout>
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
