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
import { formatPrice } from "../utils/formatPrice";

const CartPage = () => {
  const [subTotal, setSubTotal] = useState(0);
  const [billPopup, setBillPopup] = useState(false);
  const [openRooms, setOpenRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState("");
  const [form] = Form.useForm();
  const paymentMode = Form.useWatch("paymentMode", form);
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
    { title: "Цена", dataIndex: "price", render: (price) => formatPrice(price) },
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
    try {
      const selectedTable = localStorage.getItem("selectedTable")
        ? JSON.parse(localStorage.getItem("selectedTable"))
        : null;
      setSelectedTableName(selectedTable?.name || "");
    } catch {
      setSelectedTableName("");
    }
  }, []);

  useEffect(() => {
    if (!billPopup || paymentMode !== "На стая") return undefined;
    let cancelled = false;
    setRoomsLoading(true);
    setRoomsError("");
    axios
      .get("/api/bills/open-rooms")
      .then((res) => {
        if (!cancelled) setOpenRooms(Array.isArray(res.data) ? res.data : []);
      })
      .catch((error) => {
        if (!cancelled) {
          setOpenRooms([]);
          const text = error.response?.data?.message || "Хотелът не е свързан";
          setRoomsError(text);
          message.error(text);
        }
      })
      .finally(() => {
        if (!cancelled) setRoomsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [billPopup, paymentMode]);

  //handleSubmit
  const handleSubmit = async (value) => {
    try {
      const userData = JSON.parse(localStorage.getItem("auth"));
      const newObject = {
        ...value,
        cartItems,
        subTotal,
        totalAmount: Number(subTotal),
        userId: userData.userId,
        tableName: selectedTableName,
        customerName: selectedTableName,
      };
      if (value.paymentMode === "На стая") {
        const room = openRooms.find((item) => String(item.bookingId) === String(value.hotelBookingId));
        if (!room) {
          message.error("Изберете стая");
          return;
        }
        newObject.paymentMode = "На стая";
        newObject.hotelBookingId = room.bookingId;
        newObject.hotelRoomNumber = room.roomNumber;
        newObject.hotelGuestName = room.guestName;
      }
      await axios.post("/api/bills/add-bills", newObject);
      message.success(
        value.paymentMode === "На стая"
          ? `Сметката е качена на стая ${newObject.hotelRoomNumber}`
          : "Сметката е генерирана"
      );
      navigate("/bills");
    } catch (error) {
      message.error(error.response?.data?.message || error.response?.data?.error || "Нещо се обърка!");
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
            Субтотал : <b>{formatPrice(subTotal)}</b>
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
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="paymentMode" label="Метод на плащане" style={{ minWidth: 220 }} rules={[{ required: true, message: "Изберете метод на плащане" }]}>
            <Select style={{ minWidth: 220 }}>
              <Select.Option value="cash">Брой</Select.Option>
              <Select.Option value="card">Карта</Select.Option>
              <Select.Option value="На стая">На стая</Select.Option>
            </Select>
          </Form.Item>
          {paymentMode === "На стая" && (
            <Form.Item name="hotelBookingId" label="Стая" rules={[{ required: true, message: "Изберете стая" }]}>
              <Select
                style={{ minWidth: 220 }}
                loading={roomsLoading}
                placeholder={roomsError ? "Стайте не се заредиха" : openRooms.length ? "Номер или име" : "Няма настанени стаи"}
                showSearch
                optionFilterProp="label"
                onSearch={(text) => {
                  const match = openRooms.find(
                    (room) => String(room.roomNumber).toLowerCase() === String(text || "").trim().toLowerCase()
                  );
                  if (match) form.setFieldsValue({ hotelBookingId: match.bookingId });
                }}
              >
                {openRooms.map((room) => (
                  <Select.Option key={room.bookingId} value={room.bookingId} label={`${room.roomNumber} ${room.guestName}`}>
                    {`Стая ${room.roomNumber} — ${room.guestName}`}
                  </Select.Option>
                ))}
              </Select>
              {roomsError && <div style={{ color: "#cf1322", marginTop: 6 }}>{roomsError}</div>}
            </Form.Item>
          )}
          <div className="bill-it">
            <h5>
              Сума : <b>{formatPrice(subTotal)}</b>
            </h5>
            <h3>
              Обща сума -{" "}
              <b>{formatPrice(subTotal)}</b>
            </h3>
          </div>
          <div className="d-flex justify-content-end">
            <Button type="primary" htmlType="submit">
              {paymentMode === "На стая" ? "Качи на стаята" : "Генерирай сметка"}
            </Button>
          </div>
        </Form>
      </Modal>
    </DefaultLayout>
  );
};

export default CartPage;
