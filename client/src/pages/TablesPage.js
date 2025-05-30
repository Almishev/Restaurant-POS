import React, { useState, useEffect } from "react";
import DefaultLayout from "../components/DefaultLayout";
import { Button, Modal, Form, Input, message, Table } from "antd";
import axios from "axios";
import { useNavigate } from "react-router-dom";

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

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const onFinish = async (values) => {
    try {
      await axios.post("/api/tables/add-table", values);
      message.success("Масата е добавена успешно!");
      setIsModalVisible(false);
      form.resetFields();
      fetchTables();
    } catch (error) {
      message.error("Грешка при добавяне на маса!");
    }
  };

  const handleSelectTable = async (record) => {
    try {
      const user = localStorage.getItem("auth") ? JSON.parse(localStorage.getItem("auth")) : null;
      if (!user || !user.userId) {
        message.error("Няма информация за потребителя!");
        return;
      }
      // Задай избраната маса в базата
      await axios.post("/api/users/set-current-table", {
        userId: user.userId,
        tableId: record._id,
      });
      message.success(`Избрана маса: ${record.name}`);
      window.location.href = "/order";
    } catch (error) {
      message.error("Грешка при избор на маса!");
    }
  };

  const columns = [
    { title: "Маса", dataIndex: "name", key: "name" },
    {
      title: "Действие",
      key: "actions",
      render: (_, record) => (
        <Button type="primary" onClick={() => handleSelectTable(record)}>
          Избери
        </Button>
      ),
    },
  ];

  return (
    <DefaultLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Маси</h1>
        <Button type="primary" onClick={showModal}>
          Добави маса
        </Button>
      </div>
      <Table
        dataSource={tables}
        columns={columns}
        rowKey="_id"
        loading={loading}
        style={{ marginTop: 24 }}
        pagination={false}
      />
      <Modal
        title="Добави нова маса"
        visible={isModalVisible}
        onCancel={handleCancel}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Име на маса" rules={[{ required: true, message: "Въведи име!" }]}> 
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Запази
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </DefaultLayout>
  );
};

export default TablesPage; 