import React, { useEffect, useState } from "react";
import { Table, Button, Modal, Form, InputNumber, Select, message, Input } from "antd";
import axios from "axios";
import DefaultLayout from "../components/DefaultLayout";

const InventoryPage = () => {
  const [inventory, setInventory] = useState([]);
  const [items, setItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("in"); // "in" or "out"
  const [selectedItem, setSelectedItem] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const fetchInventory = async () => {
    const { data } = await axios.get("/api/inventory");
    setInventory(data);
  };

  const fetchItems = async () => {
    const { data } = await axios.get("/api/items/get-item");
    setItems(data);
  };

  useEffect(() => {
    fetchInventory();
    fetchItems();
  }, []);

  const columns = [
    { title: "Артикул", dataIndex: "name" },
    { title: "Категория", dataIndex: "category" },
    { title: "Единица", dataIndex: "unit" },
    { title: "Наличност", dataIndex: "quantity" },
    {
      title: "Действия",
      render: (_, record) => (
        <>
          <Button
            type="primary"
            onClick={() => {
              setSelectedItem(record);
              setModalType("in");
              setModalOpen(true);
            }}
            style={{ marginRight: 8 }}
          >
            Вход
          </Button>
          <Button
            danger
            onClick={() => {
              setSelectedItem(record);
              setModalType("out");
              setModalOpen(true);
            }}
          >
            Изход
          </Button>
        </>
      ),
    },
  ];

  const handleStock = async (values) => {
    try {
      await axios.post(`/api/inventory/${modalType}`, {
        name: selectedItem.name,
        category: selectedItem.category,
        unit: selectedItem.unit,
        amount: values.amount,
        user: "admin", // или вземи от auth
        note: values.note,
      });
      message.success("Операцията е успешна!");
      setModalOpen(false);
      fetchInventory();
    } catch (error) {
      message.error("Грешка при операцията!");
    }
  };

  return (
    <DefaultLayout>
      <h1>Склад</h1>
      <Button
        type="primary"
        style={{ marginBottom: 16 }}
        onClick={() => setAddModalOpen(true)}
      >
        Добави нова суровина
      </Button>
      <Table columns={columns} dataSource={inventory} rowKey="_id" bordered />
      <Modal
        title={modalType === "in" ? "Вход на стока" : "Изход на стока"}
        visible={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={false}
      >
        <Form onFinish={handleStock}>
          <Form.Item
            name="amount"
            label="Количество"
            rules={[{ required: true, message: "Въведи количество!" }]}
          >
            <InputNumber min={0.1} step={0.01} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="note" label="Бележка">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Запази
          </Button>
        </Form>
      </Modal>
      <Modal
        title="Добави нова суровина в склада"
        visible={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        footer={false}
      >
        <Form
          onFinish={async (values) => {
            try {
              await axios.post("/api/inventory/in", {
                name: values.name,
                category: values.category,
                unit: values.unit,
                amount: values.amount,
                user: "admin", // или вземи от auth
                note: values.note,
              });
              message.success("Суровината е добавена успешно!");
              setAddModalOpen(false);
              fetchInventory();
            } catch (error) {
              message.error("Грешка при добавяне на суровина!");
            }
          }}
        >
          <Form.Item
            name="name"
            label="Име на суровината"
            rules={[{ required: true, message: "Въведи име!" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="category" label="Категория">
            <Input />
          </Form.Item>
          <Form.Item
            name="unit"
            label="Единица"
            rules={[{ required: true, message: "Въведи единица!" }]}
          >
            <Select placeholder="Избери единица">
              <Select.Option value="бр.">бр.</Select.Option>
              <Select.Option value="кг.">кг.</Select.Option>
              <Select.Option value="л.">л.</Select.Option>
            
            </Select>
          </Form.Item>
          <Form.Item
            name="amount"
            label="Начално количество"
            rules={[{ required: true, message: "Въведи количество!" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="note" label="Бележка">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Запази
          </Button>
        </Form>
      </Modal>
    </DefaultLayout>
  );
};

export default InventoryPage; 