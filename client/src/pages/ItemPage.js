import React, { useEffect, useState } from "react";
import DefaultLayout from "../components/DefaultLayout";
import { useDispatch } from "react-redux";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import axios from "axios";
import { Modal, Button, Table, Form, Input, InputNumber, Select, message } from "antd";
import { formatPrice, roundPrice } from "../utils/formatPrice";

const ItemPage = () => {
  const dispatch = useDispatch();
  const [itemsData, setItemsData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [popupModal, setPopupModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const fetchCategories = async () => {
    try {
      const res = await axios.get("/api/categories/get-categories");
      setCategories(res.data);
    } catch (error) {
      console.log("Грешка при зареждане на категориите!", error);
    }
  };

  const getAllItems = async () => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      const { data } = await axios.get("/api/items/get-item");
      setItemsData(data);
      dispatch({ type: "HIDE_LOADING" });
      console.log(data);
    } catch (error) {
      dispatch({ type: "HIDE_LOADING" });
      console.log(error);
    }
  };

  useEffect(() => {
    getAllItems();
    fetchCategories();
    //eslint-disable-next-line
  }, []);

  const handleDelete = async (record) => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      await axios.post("/api/items/delete-item", { itemId: record._id });
      message.success("Артикулът е изтрит успешно");
      getAllItems();
      setPopupModal(false);
      dispatch({ type: "HIDE_LOADING" });
    } catch (error) {
      dispatch({ type: "HIDE_LOADING" });
      message.error("Възникна грешка");
      console.log(error);
    }
  };

  const columns = [
    { title: "Име", dataIndex: "name" },
    {
      title: "Цена",
      dataIndex: "price",
      render: (price) => formatPrice(price),
    },
    {
      title: "Действие",
      dataIndex: "_id",
      render: (id, record) => (
        <div>
          <EditOutlined
            style={{ cursor: "pointer" }}
            onClick={() => {
              setEditItem(record);
              setPopupModal(true);
            }}
          />
          <DeleteOutlined
            style={{ cursor: "pointer", color: "red" }}
            onClick={() => {
              handleDelete(record);
            }}
          />
        </div>
      ),
    },
  ];

  const handleSubmit = async (value) => {
    const payload = { ...value, price: roundPrice(value.price) };
    if (editItem === null) {
      try {
        dispatch({
          type: "SHOW_LOADING",
        });
        await axios.post("/api/items/add-item", payload);
        message.success("Артикулът е добавен успешно");
        getAllItems();
        setPopupModal(false);
        dispatch({ type: "HIDE_LOADING" });
      } catch (error) {
        dispatch({ type: "HIDE_LOADING" });
        message.error("Възникна грешка");
        console.log(error);
      }
    } else {
      try {
        dispatch({
          type: "SHOW_LOADING",
        });
        await axios.put("/api/items/edit-item", {
          ...payload,
          itemId: editItem._id,
        });
        message.success("Артикулът е обновен успешно");
        getAllItems();
        setPopupModal(false);
        dispatch({ type: "HIDE_LOADING" });
      } catch (error) {
        dispatch({ type: "HIDE_LOADING" });
        message.error("Възникна грешка");
        console.log(error);
      }
    }
  };

  return (
    <DefaultLayout>
      <div className="d-flex justify-content-between">
        <h1>Списък с артикули</h1>
        <Button type="primary" onClick={() => setPopupModal(true)}>
          Добави артикул
        </Button>
      </div>

      <Table columns={columns} dataSource={itemsData} bordered />

      {popupModal && (
        <Modal
          title={`${editItem !== null ? "Редактирай артикул " : "Добави нов артикул"}`}
          visible={popupModal}
          onCancel={() => {
            setEditItem(null);
            setPopupModal(false);
          }}
          footer={false}
        >
          <Form
            layout="vertical"
            initialValues={editItem}
            onFinish={handleSubmit}
          >
            <Form.Item name="name" label="Име">
              <Input />
            </Form.Item>
            <Form.Item
              name="price"
              label="Цена"
              rules={[{ required: true, message: "Въведете цена!" }]}
            >
              <InputNumber
                min={0}
                step={0.01}
                precision={2}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item name="category" label="Категория">
              <Select>
                {categories.map((cat) => (
                  <Select.Option key={cat._id} value={cat.name}>
                    {cat.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="department" label="Отдел" rules={[{ required: true, message: "Избери отдел!" }]}>
              <Select>
                <Select.Option value="kitchen">Кухня</Select.Option>
                <Select.Option value="bar">Бар</Select.Option>
              </Select>
            </Form.Item>
            <div className="d-flex justify-content-end">
              <Button type="primary" htmlType="submit">
                Запази
              </Button>
            </div>
          </Form>
        </Modal>
      )}
    </DefaultLayout>
  );
};

export default ItemPage;
