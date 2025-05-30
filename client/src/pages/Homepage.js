import React, { useState, useEffect } from "react";
import DefaultLayout from "./../components/DefaultLayout";
import axios from "axios";
import { Row, Col, message, Table, Button } from "antd";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";

const Homepage = () => {
  const { tableId } = useParams();
  const [itemsData, setItemsData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [table, setTable] = useState(null);
  const [pendingItems, setPendingItems] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Зареждане на масата по tableId
  const fetchTable = async () => {
    try {
      const res = await axios.get("/api/tables/get-tables");
      const foundTable = res.data.find((t) => t._id === tableId);
      if (!foundTable) {
        message.error("Масата не е намерена!");
        navigate("/tables");
      } else {
        setTable(foundTable);
        setPendingItems(foundTable.pendingItems || []);
        setCartItems(foundTable.cartItems || []);
        setTotalAmount(foundTable.totalAmount || 0);
      }
    } catch (error) {
      message.error("Грешка при зареждане на масата!");
      navigate("/tables");
    }
  };

  useEffect(() => {
    if (tableId) fetchTable();
  }, [tableId, navigate]);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const res = await axios.get("/api/categories/get-categories");
      setCategories(res.data);
      if (res.data.length > 0) {
        setSelectedCategory(res.data[0].name);
      }
    } catch (error) {
      message.error("Грешка при зареждане на категориите!");
    }
  };

  // Fetch items
  const fetchItems = async () => {
    try {
      dispatch({ type: "SHOW_LOADING" });
      const { data } = await axios.get("/api/items/get-item");
      setItemsData(data);
      dispatch({ type: "HIDE_LOADING" });
    } catch (error) {
      dispatch({ type: "HIDE_LOADING" });
      message.error("Грешка при зареждане на продуктите!");
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchItems();
  }, []);

  // Добавяне на артикул към pendingItems
  const handleAddToCart = async (item) => {
    let updatedPending;
    const existing = pendingItems.find((i) => i._id === item._id);
    if (existing) {
      updatedPending = pendingItems.map((i) =>
        i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i
      );
    } else {
      updatedPending = [...pendingItems, { ...item, quantity: 1 }];
    }
    await updatePendingInDB(updatedPending);
  };

  // Премахване на артикул от pendingItems
  const handleRemoveFromCart = async (item) => {
    const updatedPending = pendingItems.filter((i) => i._id !== item._id);
    await updatePendingInDB(updatedPending);
  };

  // Промяна на количество
  const handleChangeQuantity = async (item, delta) => {
    const updatedPending = pendingItems.map((i) =>
      i._id === item._id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
    );
    await updatePendingInDB(updatedPending);
  };

  // Обновяване на pendingItems в MongoDB
  const updatePendingInDB = async (updatedPending) => {
    const newTotal = updatedPending.reduce((sum, i) => sum + i.price * i.quantity, 0);
    try {
      await axios.put("/api/tables/update-table-pending-items", {
        tableId,
        pendingItems: updatedPending,
        totalAmount: newTotal,
      });
      setPendingItems(updatedPending);
      setTotalAmount(newTotal);
    } catch (error) {
      message.error("Грешка при обновяване на поръчката!");
    }
  };

  // Изпрати към кухнята (само pendingItems)
  const handleSendToKitchen = async () => {
    try {
      await axios.post("/api/kitchen/send-order", {
        tableName: table.name,
        items: pendingItems,
      });
      // Мести pendingItems в cartItems и изчисти pendingItems
      await axios.put("/api/tables/update-table-cart", {
        tableId,
        cartItems: [...(table.cartItems || []), ...pendingItems],
        totalAmount,
      });
      await updatePendingInDB([]); // изчисти pendingItems
      await fetchTable(); // обнови интерфейса
      message.success("Поръчката е изпратена към кухнята!");
    } catch (error) {
      message.error("Грешка при изпращане към кухнята!");
    }
  };

  // Генерирай сметка (ако има pendingItems, първо ги изпрати към кухнята)
  const handleGenerateBillClick = async () => {
    if (pendingItems.length > 0) {
      await handleSendToKitchen();
      // handleSendToKitchen вече ще навигира към /tables, така че може да се върнеш тук ако искаш да покажеш модал за сметка
      // Ако искаш да останеш на страницата, премахни navigate от handleSendToKitchen
    } else {
      handleGenerateBill();
    }
  };

  // Placeholder за handleGenerateBill, ако липсва
  const handleGenerateBill = () => {
    message.info("Генериране на сметка (функционалност по избор)");
    // Тук може да добавиш логика за реално генериране на сметка
  };

  if (!table) return null;

  const cartColumns = [
    { title: "Име", dataIndex: "name" },
    { title: "Цена", dataIndex: "price" },
    {
      title: "Количество",
      dataIndex: "quantity",
      render: (quantity, record) => (
        <div>
          <Button size="small" onClick={() => handleChangeQuantity(record, 1)}>+</Button>
          <b style={{ margin: "0 8px" }}>{quantity}</b>
          <Button size="small" onClick={() => handleChangeQuantity(record, -1)} disabled={quantity <= 1}>-</Button>
        </div>
      ),
    },
    {
      title: "Действие",
      dataIndex: "_id",
      render: (_, record) => (
        <Button danger size="small" onClick={() => handleRemoveFromCart(record)}>
          Премахни
        </Button>
      ),
    },
  ];

  // Колони за изпратени артикули (неактивни)
  const sentColumns = [
    { title: "Име", dataIndex: "name" },
    { title: "Цена", dataIndex: "price" },
    { title: "Количество", dataIndex: "quantity" },
    { title: "Статус", render: () => <span style={{ color: '#888' }}>Изпратено</span> },
  ];

  // Изчисли общата сума за всички артикули (изпратени + текущи)
  const grandTotal = [...cartItems, ...pendingItems].reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <DefaultLayout>
      <div style={{ marginBottom: 24 }}>
        <h2>Работиш на маса: <b>{table.name}</b></h2>
      </div>
      <Row gutter={24}>
        {/* Категории в ляво */}
        <Col xs={24} md={6} lg={5}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            {categories.map((category) => (
              <div
                key={category._id}
                className={`d-flex category ${selectedCategory === category.name && "category-active"}`}
                style={{ width: "100%", marginBottom: 16, justifyContent: "flex-start", cursor: "pointer" }}
                onClick={() => setSelectedCategory(category.name)}
              >
                <h4>{category.name}</h4>
              </div>
            ))}
          </div>
        </Col>
        {/* Продукти в центъра */}
        <Col xs={24} md={10} lg={11}>
          <Row gutter={[16, 16]}>
            {itemsData
              .filter((i) => i.category === selectedCategory)
              .map((item) => (
                <Col xs={24} sm={12} md={24} lg={12} key={item._id}>
                  <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 16, textAlign: "center", background: "#fafcff" }}>
                    <h4>{item.name}</h4>
                    <div style={{ margin: "8px 0" }}><b>{item.price} лв</b></div>
                    <Button type="primary" onClick={() => handleAddToCart(item)}>
                      Добави
                    </Button>
                  </div>
                </Col>
              ))}
          </Row>
        </Col>
        {/* Количка вдясно */}
        <Col xs={24} md={8} lg={8}>
          <div style={{ background: "#f8fafd", border: "1px solid #e3e3e3", borderRadius: 8, padding: 16, minHeight: 300 }}>
            <h3>Количка за маса: <b>{table.name}</b></h3>
            {/* Изпратени артикули */}
            {cartItems.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 'bold', color: '#888', marginBottom: 4 }}>Изпратени към кухнята</div>
                <Table
                  columns={sentColumns}
                  dataSource={cartItems}
                  rowKey="_id"
                  pagination={false}
                  bordered
                  size="small"
                  style={{ background: '#f3f3f3' }}
                />
              </div>
            )}
            {/* Текуща поръчка */}
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Текуща поръчка</div>
            <Table
              columns={cartColumns}
              dataSource={pendingItems}
              rowKey="_id"
              pagination={false}
              bordered
              size="small"
            />
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <h2>Общо: {grandTotal} лв</h2>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <Button type="default" onClick={handleSendToKitchen} disabled={pendingItems.length === 0}>
                Изпрати към кухнята
              </Button>
              <Button type="primary" onClick={handleGenerateBillClick} disabled={grandTotal === 0}>
                Генерирай сметка
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </DefaultLayout>
  );
};

export default Homepage;
