import React, { useState, useEffect } from "react";
import DefaultLayout from "../components/DefaultLayout";
import { Button, Modal, Form, Input, message, Table, Popconfirm } from "antd";
import axios from "axios";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editCategory, setEditCategory] = useState(null);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/categories/get-categories");
      setCategories(res.data);
    } catch (error) {
      message.error("Грешка при зареждане на категориите!");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
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
      if (editCategory) {
        await axios.put(`/api/categories/edit-category/${editCategory._id}`, values);
        message.success("Категорията е редактирана успешно!");
      } else {
        await axios.post("/api/categories/add-category", values);
        message.success("Категорията е добавена успешно!");
      }
      setIsModalVisible(false);
      setEditCategory(null);
      form.resetFields();
      fetchCategories();
    } catch (error) {
      message.error("Грешка при добавяне/редакция на категория!");
    }
  };

  const handleEdit = (record) => {
    setEditCategory(record);
    setIsModalVisible(true);
    form.setFieldsValue({ name: record.name });
  };

  const handleDelete = async (record) => {
    try {
      await axios.delete(`/api/categories/delete-category/${record._id}`);
      message.success("Категорията е изтрита успешно!");
      fetchCategories();
    } catch (error) {
      message.error("Грешка при изтриване на категория!");
    }
  };

  const columns = [
    { title: "Категория", dataIndex: "name", key: "name" },
    {
      title: "Действие",
      key: "actions",
      render: (_, record) => (
        <div>
          <EditOutlined
            style={{ cursor: "pointer", marginRight: 16 }}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Сигурни ли сте, че искате да изтриете тази категория?"
            onConfirm={() => handleDelete(record)}
            okText="Да"
            cancelText="Не"
          >
            <DeleteOutlined style={{ cursor: "pointer", color: "red" }} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <DefaultLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Категории</h1>
        <Button type="primary" onClick={showModal}>
          Добави категория
        </Button>
      </div>
      <Table
        dataSource={categories}
        columns={columns}
        rowKey="_id"
        loading={loading}
        style={{ marginTop: 24 }}
        pagination={false}
      />
      <Modal
        title={editCategory ? "Редактирай категория" : "Добави нова категория"}
        visible={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditCategory(null);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Име на категория" rules={[{ required: true, message: "Въведи име!" }]}> 
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {editCategory ? "Запази промените" : "Запази"}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </DefaultLayout>
  );
};

export default CategoriesPage; 