import React, { useState, useEffect, useCallback } from "react";
import DefaultLayout from "./../components/DefaultLayout";
import axios from "axios";
import { Row, Col, message, Table, Button, Modal, Form, Input, Select, Drawer } from "antd";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircleTwoTone, SwapOutlined, MenuOutlined, DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import TransferItemsModal from "../components/TransferItemsModal";
import TransferTableModal from "../components/TransferTableModal";

const Homepage = () => {
  const { tableId } = useParams();
  const [itemsData, setItemsData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [table, setTable] = useState(null);
  const [pendingItems, setPendingItems] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [billPopup, setBillPopup] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferTableModalVisible, setTransferTableModalVisible] = useState(false);
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [drawerVisible, setDrawerVisible] = useState(false);
  // Зареждане на масата по tableId
  const fetchTable = useCallback(async () => {
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
  }, [tableId, navigate]);
  useEffect(() => {
    if (tableId) fetchTable();
  }, [tableId, navigate, fetchTable]);
  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get("/api/categories/get-categories");
      setCategories(res.data);
      if (res.data.length > 0) {
        setSelectedCategory(res.data[0].name);
      }
    } catch (error) {
      message.error("Грешка при зареждане на категориите!");
    }
  }, []);

  // Fetch items
  const fetchItems = useCallback(async () => {
    try {
      dispatch({ type: "SHOW_LOADING" });
      const { data } = await axios.get("/api/items/get-item");
      setItemsData(data);
      dispatch({ type: "HIDE_LOADING" });
    } catch (error) {
      dispatch({ type: "HIDE_LOADING" });
      message.error("Грешка при зареждане на продуктите!");
    }
  }, [dispatch]);
  useEffect(() => {
    fetchCategories();
    fetchItems();
  }, [fetchCategories, fetchItems]);// Зареждане на статусите от кухнята (готови артикули)
  useEffect(() => {
    const fetchKitchenOrders = async () => {
      try {
        const res = await axios.get('/api/kitchen/orders');
        setKitchenOrders(res.data);
      } catch (error) {
        console.error("Грешка при зареждане на поръчките от кухнята:", error);
      }
    };
    
    // Функция за опресняване на данните за масата
    const refreshTableData = async () => {
      if (tableId) {
        try {
          const res = await axios.get("/api/tables/get-tables");
          const foundTable = res.data.find((t) => t._id === tableId);
          if (foundTable) {
            setTable(foundTable);
            setPendingItems(foundTable.pendingItems || []);
            setCartItems(foundTable.cartItems || []);
            setTotalAmount(foundTable.totalAmount || 0);
          }
        } catch (error) {
          console.error("Грешка при опресняване на данните за масата:", error);
        }
      }
    };
    
    // Извикваме веднага
    fetchKitchenOrders();
    
    // Задаваме интервал за автоматично опресняване
    const kitchenInterval = setInterval(fetchKitchenOrders, 5000); 
    const tableInterval = setInterval(refreshTableData, 5000);
    
    // Почистване при размонтиране на компонента
    return () => {
      clearInterval(kitchenInterval);
      clearInterval(tableInterval);
    };
  }, [tableId]);

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
        // Добавяме status: "Изпратено" към всеки елемент преди да го преместим в cartItems
      const itemsWithStatus = pendingItems.map(item => {
        // Проверка дали вече има статус и ако няма, задаваме "Изпратено"
        if (!item.status) {
          return {
            ...item,
            status: "Изпратено"
          };
        }
        // Ако статусът е "Готово", запазваме го
        return item;
      });
      
      console.log("[SEND TO KITCHEN] Артикули за изпращане:", itemsWithStatus);
      
      // Мести pendingItems в cartItems и изчисти pendingItems
      await axios.put("/api/tables/update-table-cart", {
        tableId,
        cartItems: [...(table.cartItems || []), ...itemsWithStatus],
        totalAmount,
      });
      
      await updatePendingInDB([]); // изчисти pendingItems
      await fetchTable(); // обнови интерфейса
      message.success("Поръчката е изпратена към кухнята!");
    } catch (error) {
      message.error("Грешка при изпращане към кухнята!");
      console.error(error);
    }
  };
  // Генерирай сметка (ако има pendingItems, първо ги изпрати към кухнята)
  const handleGenerateBillClick = async () => {
    if (pendingItems.length > 0) {
      await handleSendToKitchen();
    }
    setBillPopup(true);
  };

  // Вземи логнатия потребител
  const userData = localStorage.getItem("auth") ? JSON.parse(localStorage.getItem("auth")) : null;

  // Генериране на сметка
  const handleSubmitBill = async (value) => {
    try {
      console.log("[DEBUG] cartItems:", cartItems);
      console.log("[DEBUG] pendingItems:", pendingItems);
      const allItems = [...cartItems, ...pendingItems];
      const total = allItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      // Вземи userId на логнатия потребител
      const userId = userData?.userId;
      const newObject = {
        ...value,
        cartItems: allItems,
        subTotal: total,
        totalAmount: Number(total),
        tableId: tableId,
        userId: userId, // добавяме userId
      };
      console.log("[DEBUG] newObject за изпращане към /api/bills/add-bills:", newObject);
      await axios.post("/api/bills/add-bills", newObject);
      message.success("Сметката е генерирана");
      setBillPopup(false);
      // Изчистване на количката за масата
      await axios.put("/api/tables/update-table-cart", {
        tableId,
        cartItems: [],
        totalAmount: 0,
      });
      await updatePendingInDB([]);
      await axios.delete(`/api/tables/delete-table/${tableId}`);
      localStorage.removeItem("selectedTable");
      navigate("/tables");
    } catch (error) {
      message.error("Нещо се обърка!");
      console.log(error);
    }
  };

  if (!table) {
    return (
      <div style={{ textAlign: "center", marginTop: 100 }}>
        <h2>Няма избрана маса!</h2>
        <Button type="primary" onClick={() => navigate("/tables")}>Избери маса</Button>
      </div>
    );
  }

  // Отваряне на модалния прозорец за прехвърляне
  const showTransferModal = () => {
    setTransferModalVisible(true);
  };

  // Затваряне на модалния прозорец за прехвърляне
  const handleTransferCancel = () => {
    setTransferModalVisible(false);
    // Презареждаме данните за масата след прехвърлянето
    fetchTable();
  };

  const cartColumns = [
    { title: "Име", dataIndex: "name" },
    { title: "Цена", dataIndex: "price" },
    {
      title: "Количество",
      dataIndex: "quantity",
      render: (quantity, record) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Button size="small" style={{ minWidth: 28, height: 28, padding: 0 }} onClick={() => handleChangeQuantity(record, 1)}>+</Button>
          <b style={{ margin: "0 4px", minWidth: 18, textAlign: 'center', display: 'inline-block' }}>{quantity}</b>
          <Button size="small" style={{ minWidth: 28, height: 28, padding: 0 }} onClick={() => handleChangeQuantity(record, -1)} disabled={quantity <= 1}>-</Button>
        </div>
      ),
    },
    {
      title: "Действие",
      dataIndex: "_id",
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined style={{ fontSize: 20 }} />}
            onClick={() => handleRemoveFromCart(record)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, width: 32, height: 32 }}
          />
        </div>
      ),
    },
  ];
  // Колони за изпратени артикули (неактивни)
  const sentColumns = [
    { title: "Име", dataIndex: "name" },
    { title: "Цена", dataIndex: "price" },
    { title: "Количество", dataIndex: "quantity" },    { title: "Статус", render: (_, record) => {      // Извеждаме в конзолата информация за debugging
      console.log(`[STATUS CHECK] Артикул: ${record.name}, Статус: ${record.status || 'няма'}`);

      // Проверка за статус от record
      if (record.status === "Готово") {
        console.log(`[STATUS CHECK] Артикул ${record.name} има статус Готово директно в record`);
        return <span style={{ color: 'green' }}><CheckCircleTwoTone twoToneColor="#52c41a" /> Готово</span>;
      }
      
      // Специална проверка за салата Цезар
      if (record.name === "Цезар") {
        console.log(`[STATUS CHECK] Проверка на специален случай за Цезар: ${JSON.stringify(record)}`);
      }
      
      // Проверка дали артикулът е маркиран като готов в active orders
      let isDone = false;
      for (const order of kitchenOrders) {
        if (order.tableName === table.name) {
          for (const item of order.items) {
            if (item.name === record.name && item.done === true) {
              isDone = true;
              console.log(`[STATUS CHECK] Артикул ${record.name} е маркиран като готов в активна поръчка`);
              break;
            }
          }
          if (isDone) break;
        }
      }
      
      return isDone ? 
        <span style={{ color: 'green' }}><CheckCircleTwoTone twoToneColor="#52c41a" /> Готово</span> : 
        <span style={{ color: '#888' }}>Изпратено</span>;
    } },
  ];

  // Изчисли общата сума за всички артикули (изпратени + текущи)
  const grandTotal = [...cartItems, ...pendingItems].reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Проверка дали има артикули, които могат да бъдат прехвърлени
  const hasTransferableItems = cartItems.length > 0 || pendingItems.length > 0;

  const handleTableTransferSuccess = () => {
    localStorage.removeItem("selectedTable");
    navigate("/tables");
  };

  return (
    <DefaultLayout>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Работиш на маса: <b>{table.name}</b></h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button 
            type="default" 
            icon={<SwapOutlined />} 
            onClick={showTransferModal} 
            disabled={!hasTransferableItems}
            style={{ marginLeft: 16, background: '#003366', color: '#fff', border: 'none' }}
          >
            Прехвърли артикули
          </Button>
          <Button
            type="default"
            onClick={() => setTransferTableModalVisible(true)}
            style={{ background: '#A3A7D2', color: '#003366', border: 'none' }}
          >
            Прехвърли маса
          </Button>
        </div>
      </div>
      <Row gutter={24}>
        {/* Категории в ляво */}
        <Col xs={24} md={6} lg={5}>
          {/* Мобилен изглед: hamburger бутон и Drawer */}
          {window.innerWidth < 768 ? (
            <>
              <Button
                icon={<MenuOutlined />}
                onClick={() => setDrawerVisible(true)}
                style={{ marginBottom: 16, background: '#003366', color: '#fff', border: 'none' }}
              >
                Категории
              </Button>
              <Drawer
                title="Категории"
                placement="left"
                onClose={() => setDrawerVisible(false)}
                visible={drawerVisible}
                bodyStyle={{ padding: 0 }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  {categories.map((category) => (
                    <div
                      key={category._id}
                      className={`d-flex category ${selectedCategory === category.name && "category-active"}`}
                      style={{ width: "100%", marginBottom: 16, background: "#003366", justifyContent: "flex-start", cursor: "pointer" }}
                      onClick={() => {
                        setSelectedCategory(category.name);
                        setDrawerVisible(false);
                      }}
                    >
                      <h4 style={{ color: "white" }}>{category.name}</h4>
                    </div>
                  ))}
                </div>
              </Drawer>
            </>
          ) : (
            // Десктоп изглед: страничен списък
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              {categories.map((category) => (
                <div
                  key={category._id}
                  className={`d-flex category ${selectedCategory === category.name && "category-active"}`}
                  style={{ width: "100%", marginBottom: 16, background: "#003366", justifyContent: "flex-start", cursor: "pointer" }}
                  onClick={() => setSelectedCategory(category.name)}
                >
                  <h4 style={{ color: "white" }}>{category.name}</h4>
                </div>
              ))}
            </div>
          )}
        </Col>
        {/* Продукти в центъра */}
        <Col xs={24} md={10} lg={11}>
          <Row gutter={[16, 16]}>
            {itemsData
              .filter((i) => i.category === selectedCategory)
              .map((item) => (
                <Col xs={24} sm={12} md={24} lg={12} key={item._id}>
                  <div style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 8,
                    background: "#CED0E8",
                    marginBottom: 8,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    minHeight: 40,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#003366', flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <span style={{ fontSize: 14, color: '#333', flex: 1, textAlign: 'center', minWidth: 48 }}><b>{item.price} лв</b></span>
                    <Button
                      type="primary"
                      onClick={() => handleAddToCart(item)}
                      style={{
                        background: '#003366',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 14,
                        borderRadius: 6,
                        height: 32,
                        minWidth: 40,
                        padding: '0 8px',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      size="middle"
                    >
                      <ShoppingCartOutlined style={{ fontSize: 20 }} />
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
              <Button type="default" style={{background:"#A3A7D2", borderRadius: "12px" }} onClick={handleSendToKitchen} disabled={pendingItems.length === 0}>
                Изпрати към кухнята
              </Button>
              <Button type="primary" style={{ borderRadius: "12px" }} onClick={handleGenerateBillClick} disabled={grandTotal === 0}>
                Генерирай сметка
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Модален прозорец за създаване на сметка */}
      <Modal
        title="Създай сметка"
        visible={billPopup}
        onCancel={() => setBillPopup(false)}
        footer={false}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitBill} initialValues={{ customerName: table.name, waiter: userData?.name }}>
          <Form.Item name="customerName" label="Манса">
            <Input />
          </Form.Item>
          <Form.Item name="waiter" label="Сервитьор">
            <Input disabled />
          </Form.Item>
          <Form.Item 
            name="paymentMode" 
            label="Метод на плащане" 
            style={{ minWidth: 220 }}
            rules={[{ required: true, message: 'Моля, изберете метод на плащане' }]}
          >
            <Select style={{ minWidth: 220 }}>
              <Select.Option value="Брой">Брой</Select.Option>
              <Select.Option value="Карта">Карта</Select.Option>
            </Select>
          </Form.Item>
          <div className="bill-it">
            <h5>
              Сума : <b>{grandTotal}</b>
            </h5>
            <h3>
              Обща сума - <b>{grandTotal}</b>
            </h3>
          </div>
          <div className="d-flex justify-content-end">
            <Button type="primary" htmlType="submit">
              Генерирай сметка
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Модален прозорец за прехвърляне на артикули */}
      <TransferItemsModal
        visible={transferModalVisible}
        onCancel={handleTransferCancel}
        currentTableId={tableId}
        currentTableName={table.name}
      />

      {/* Модален прозорец за прехвърляне на маса */}
      <TransferTableModal
        visible={transferTableModalVisible}
        onCancel={() => setTransferTableModalVisible(false)}
        tableId={tableId}
        currentWaiterName={table.createdBy}
        onTransferSuccess={handleTableTransferSuccess}
      />
    </DefaultLayout>
  );
};

export default Homepage;
