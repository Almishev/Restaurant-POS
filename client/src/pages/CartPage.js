import React, { useState, useEffect } from "react";
import DefaultLayout from "../components/DefaultLayout";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  DeleteOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import { Table, Button, Modal, message, Form, Input, Select } from "antd";
import SelectedTableInfo from "../components/SelectedTableInfo";

const CartPage = () => {
  const [subTotal, setSubTotal] = useState(0);
  const [billPopup, setBillPopup] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { cartItems } = useSelector((state) => state.rootReducer);
  const [selectedTableName, setSelectedTableName] = useState("");

  //handle increament
  const handleIncreament = (record) => {
    dispatch({
      type: "UPDATE_CART",
      payload: { ...record, quantity: record.quantity + 1 },
    });
  };
  const handleDecreament = (record) => {
    if (record.quantity !== 1) {
      dispatch({
        type: "UPDATE_CART",
        payload: { ...record, quantity: record.quantity - 1 },
      });
    }
  };
  const columns = [
    { title: "Име", dataIndex: "name" },
    { title: "Цена", dataIndex: "price" },
    {
      title: "Количество",
      dataIndex: "_id",
      render: (id, record) => (
        <div>
          <PlusCircleOutlined
            className="mx-3"
            style={{ cursor: "pointer" }}
            onClick={() => handleIncreament(record)}
          />
          <b>{record.quantity}</b>
          <MinusCircleOutlined
            className="mx-3"
            style={{ cursor: "pointer" }}
            onClick={() => handleDecreament(record)}
          />
        </div>
      ),
    },
    {
      title: "Действие",
      dataIndex: "_id",
      render: (id, record) => (
        <DeleteOutlined
          style={{ cursor: "pointer" }}
          onClick={() =>
            dispatch({
              type: "DELETE_FROM_CART",
              payload: record,
            })
          }
        />
      ),
    },
  ];

  useEffect(() => {
    let temp = 0;
    cartItems.forEach((item) => (temp = temp + item.price * item.quantity));
    setSubTotal(temp);
  }, [cartItems]);

  useEffect(() => {
    const fetchSelectedTable = async () => {
      const user = localStorage.getItem("auth") ? JSON.parse(localStorage.getItem("auth")) : null;
      if (user && user.userId) {
        // Вземи избраната маса за потребителя
        const res = await axios.get(`/api/users/get-current-table/${user.userId}`);
        const tableId = res.data.currentTableId;
        if (tableId) {
          // Вземи името на масата
          const tablesRes = await axios.get("/api/tables/get-tables");
          const table = tablesRes.data.find((t) => t._id === tableId);
          setSelectedTableName(table ? table.name : "");
        }
      }
    };
    fetchSelectedTable();
  }, []);

  //handleSubmit
  const handleSubmit = async (value) => {
    try {
      const newObject = {
        ...value,
        cartItems,
        subTotal,
        totalAmount: Number(subTotal),
        userId: JSON.parse(localStorage.getItem("auth"))._id,
      };
      await axios.post("/api/bills/add-bills", newObject);
      message.success("Сметката е генерирана");
      navigate("/bills");
    } catch (error) {
      message.error("Нещо се обърка!");
      console.log(error);
    }
  };

  // Изпращане на поръчка към кухнята
  const handleSendToKitchen = async () => {
    try {
      if (!selectedTableName) {
        message.error("Няма избрана маса!");
        return;
      }
      if (cartItems.length === 0) {
        message.error("Количката е празна!");
        return;
      }
      // Подготвяме артикули без цени
      const items = cartItems.map(item => ({ name: item.name, quantity: item.quantity }));
      await axios.post("/api/kitchen/send-order", {
        tableName: selectedTableName,
        items,
      });
      message.success("Поръчката е изпратена към кухнята!");
      // Може да изчистим количката тук, ако желаеш
    } catch (error) {
      message.error("Грешка при изпращане към кухнята!");
    }
  };

  return (
    <DefaultLayout>
      <SelectedTableInfo />
      <h1>Количка</h1>
      <Table columns={columns} dataSource={cartItems} bordered />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
        <Button type="default" onClick={handleSendToKitchen}>
          Изпрати към кухнята
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h3 style={{ margin: 0 }}>
            Субтотал : <b>{subTotal}</b> лв
          </h3>
          <Button type="primary" onClick={() => setBillPopup(true)}>
            Генерирай сметка
          </Button>
        </div>
      </div>
      <Modal
        title="Създай сметка"
        visible={billPopup}
        onCancel={() => setBillPopup(false)}
        footer={false}
      >
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="customerName" label="Име на клиент">
            <Input />
          </Form.Item>
          <Form.Item name="customerNumber" label="Контакт">
            <Input />
          </Form.Item>

          <Form.Item name="paymentMode" label="Метод на плащане" style={{ minWidth: 220 }}>
            <Select style={{ minWidth: 220 }}>
              <Select.Option value="cash">Брой</Select.Option>
              <Select.Option value="card">Карта</Select.Option>
            </Select>
          </Form.Item>
          <div className="bill-it">
            <h5>
              Сума : <b>{subTotal}</b>
            </h5>
            <h3>
              Обща сума -{" "}
              <b>{subTotal}</b>
            </h3>
          </div>
          <div className="d-flex justify-content-end">
            <Button type="primary" htmlType="submit">
              Генерирай сметка
            </Button>
          </div>
        </Form>
      </Modal>
    </DefaultLayout>
  );
};

export default CartPage;
