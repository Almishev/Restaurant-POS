import React, { useState, useEffect, useCallback, useRef } from "react";
import DefaultLayout from "./../components/DefaultLayout";
import axios from "axios";
import { Row, Col, message, Button, Modal, Form, Input, InputNumber, Select, Dropdown, Menu } from "antd";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircleTwoTone, CloseOutlined, CheckOutlined, ShoppingCartOutlined, AppstoreOutlined, DownOutlined, SearchOutlined } from '@ant-design/icons';
import TransferItemsModal from "../components/TransferItemsModal";
import TransferTableModal from "../components/TransferTableModal";
import RenameTableModal from "../components/RenameTableModal";
import OrderCartPanel from "../components/OrderCartPanel";
import { formatPrice } from "../utils/formatPrice";
import { useIsMobile } from "../hooks/useIsMobile";
import "../styles/OrderPage.css";

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
  const [renameTableModalVisible, setRenameTableModalVisible] = useState(false);
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const [addQuantity, setAddQuantity] = useState(1);
  const [itemToAdd, setItemToAdd] = useState(null);
  const [cartTab, setCartTab] = useState("pending");
  const [mobileView, setMobileView] = useState("menu"); // menu | cart
  const [itemSearch, setItemSearch] = useState("");
  const pendingOrderScrollRef = useRef(null);
  const isMobile = useIsMobile(768);

  const scrollToPendingItem = useCallback((itemId) => {
    if (!itemId) return;
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = pendingOrderScrollRef.current;
        const root = container || document;
        const row =
          root.querySelector?.(`.ant-table-tbody > tr[data-row-key="${itemId}"]`) ||
          root.querySelector?.(`[data-row-key="${itemId}"]`) ||
          document.querySelector(`[data-row-key="${itemId}"]`);
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 80);
    });
  }, []);
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
  }, [fetchCategories, fetchItems]);

  // Poll kitchen status + table cart so waiters see "Готово" without manual refresh.
  // Skip setState when nothing changed to avoid pointless re-renders.
  useEffect(() => {
    let cancelled = false;
    const POLL_MS = 10000;

    const sameItems = (a = [], b = []) => {
      if (a === b) return true;
      if (a.length !== b.length) return false;
      return JSON.stringify(a) === JSON.stringify(b);
    };

    const fetchKitchenOrders = async () => {
      try {
        const res = await axios.get("/api/kitchen/orders");
        if (cancelled) return;
        setKitchenOrders((prev) => (sameItems(prev, res.data) ? prev : res.data));
      } catch (error) {
        console.error("Грешка при зареждане на поръчките от кухнята:", error);
      }
    };

    const refreshTableData = async () => {
      if (!tableId) return;
      try {
        const res = await axios.get("/api/tables/get-tables");
        if (cancelled) return;
        const foundTable = res.data.find((t) => t._id === tableId);
        if (!foundTable) return;
        setTable((prev) =>
          prev &&
          sameItems(prev.pendingItems, foundTable.pendingItems) &&
          sameItems(prev.cartItems, foundTable.cartItems) &&
          prev.totalAmount === foundTable.totalAmount
            ? prev
            : foundTable
        );
        setPendingItems((prev) =>
          sameItems(prev, foundTable.pendingItems || []) ? prev : foundTable.pendingItems || []
        );
        setCartItems((prev) =>
          sameItems(prev, foundTable.cartItems || []) ? prev : foundTable.cartItems || []
        );
        setTotalAmount((prev) =>
          prev === (foundTable.totalAmount || 0) ? prev : foundTable.totalAmount || 0
        );
      } catch (error) {
        console.error("Грешка при опресняване на данните за масата:", error);
      }
    };

    fetchKitchenOrders();
    const kitchenInterval = setInterval(fetchKitchenOrders, POLL_MS);
    const tableInterval = setInterval(refreshTableData, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(kitchenInterval);
      clearInterval(tableInterval);
    };
  }, [tableId]);

  // Добавяне на артикул към pendingItems с модал за забележка
  const handleAddToCartWithNote = (item) => {
    console.log('[DEBUG] Натиснат е бутона за добавяне на артикул:', item);
    setItemToAdd(item);
    setNoteValue("");
    setAddQuantity(1);
    setIsNoteModalVisible(true);
  };

  const handleNoteModalOk = async () => {
    console.log('[DEBUG] Потвърдено добавяне с бележка:', noteValue, itemToAdd, addQuantity);
    if (!itemToAdd) {
      console.error('[DEBUG] itemToAdd е null!');
      setIsNoteModalVisible(false);
      return;
    }
    const qty = Math.max(1, Number(addQuantity) || 1);
    let updatedPending;
    const item = { ...itemToAdd, quantity: qty, note: noteValue };
    const existing = pendingItems.find((i) => i._id === item._id);
    if (existing) {
      updatedPending = pendingItems.map((i) =>
        i._id === item._id
          ? { ...i, quantity: i.quantity + qty, note: noteValue || i.note }
          : i
      );
    } else {
      updatedPending = [...pendingItems, item];
    }
    console.log('[DEBUG] updatedPending:', updatedPending);
    await updatePendingInDB(updatedPending);
    setIsNoteModalVisible(false);
    setNoteValue("");
    setAddQuantity(1);
    setItemToAdd(null);
    setCartTab("pending");
    setMobileView("cart");
    scrollToPendingItem(item._id);
  };

  const handleNoteModalCancel = () => {
    console.log('[DEBUG] Затваряне на модала за забележка');
    setIsNoteModalVisible(false);
    setNoteValue("");
    setAddQuantity(1);
    setItemToAdd(null);
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
    console.log('[DEBUG] updatePendingInDB tableId:', tableId, 'updatedPending:', updatedPending, 'newTotal:', newTotal);
    if (!tableId) {
      console.error('[DEBUG] Липсва tableId!');
      return;
    }
    try {
      const res = await axios.put("/api/tables/update-table-pending-items", {
        tableId,
        pendingItems: updatedPending,
        totalAmount: newTotal,
      });
      console.log('[DEBUG] updatePendingInDB response:', res.data);
      setPendingItems(updatedPending);
      setTotalAmount(newTotal);
    } catch (error) {
      message.error("Грешка при обновяване на поръчката!");
      console.error('[DEBUG] Грешка при updatePendingInDB:', error);
    }
  };
  // Изпрати към кухнята (само pendingItems)
  const handleSendToKitchen = async () => {
    try {
      await axios.post("/api/kitchen/send-order", {
        tableName: table.name,
        items: pendingItems,
        waiterName: userData?.name,
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
      setCartTab("sent");
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
      console.log("[DEBUG] value от формата:", value);
      const newObject = {
        ...value,
        customerName: table.name,
        tableName: table.name,
        tableId: tableId,
        cartItems: allItems,
        subTotal: total,
        totalAmount: Number(total),
        userId: userId,
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

  // Статус за изпратени артикули
  const getSentStatus = (record) => {
      if (record.status === "Готово") {
        return <span style={{ color: 'green' }}><CheckCircleTwoTone twoToneColor="#52c41a" /> Готово</span>;
      }
      let isDone = false;
      for (const order of kitchenOrders) {
        if (order.tableName === table.name) {
          for (const item of order.items) {
            if (item.name === record.name && item.done === true) {
              isDone = true;
              break;
            }
          }
          if (isDone) break;
        }
      }
      return isDone ? 
        <span style={{ color: 'green' }}><CheckCircleTwoTone twoToneColor="#52c41a" /> Готово</span> : 
        <span style={{ color: '#888' }}>Изпратено</span>;
  };

  // Изчисли общата сума за всички артикули (изпратени + текущи)
  const grandTotal = [...cartItems, ...pendingItems].reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Общ брой бройки (не само видове артикули)
  const cartPiecesCount = [...cartItems, ...pendingItems].reduce(
    (sum, i) => sum + (Number(i.quantity) || 0),
    0
  );

  // Проверка дали има артикули, които могат да бъдат прехвърлени
  const hasTransferableItems = cartItems.length > 0 || pendingItems.length > 0;

  const searchQuery = itemSearch.trim().toLowerCase();
  const filteredItems = itemsData.filter((item) => {
    if (searchQuery) {
      return (item.name || "").toLowerCase().includes(searchQuery);
    }
    return item.category === selectedCategory;
  });

  const handleTableTransferSuccess = () => {
    localStorage.removeItem("selectedTable");
    navigate("/tables");
  };

  const handleTableRenamed = (updatedTable) => {
    if (!updatedTable) return;
    setTable(updatedTable);
    localStorage.setItem("selectedTable", JSON.stringify(updatedTable));
  };

  return (
    <DefaultLayout>
      <div className={`order-page ${isMobile ? "order-page-mobile" : "order-page-desktop"}`}>
        <div className="order-page-toolbar">
          <h2>
            Работиш на маса: <b>{table.name}</b>
          </h2>
          <div className="toolbar-actions">
            <Dropdown
              trigger={["click"]}
              overlay={
                <Menu>
                  <Menu.Item
                    key="rename-table"
                    onClick={() => setRenameTableModalVisible(true)}
                  >
                    Смяна на име
                  </Menu.Item>
                  <Menu.Item
                    key="transfer-items"
                    disabled={!hasTransferableItems}
                    onClick={showTransferModal}
                  >
                    Прехвърли артикули
                  </Menu.Item>
                  <Menu.Item
                    key="transfer-table"
                    onClick={() => setTransferTableModalVisible(true)}
                  >
                    Прехвърли маса
                  </Menu.Item>
                </Menu>
              }
            >
              <a
                className="order-operations-link"
                href="#operations"
                onClick={(e) => e.preventDefault()}
              >
                Операции <DownOutlined style={{ fontSize: 10 }} />
              </a>
            </Dropdown>
          </div>
        </div>

        {isMobile && (
          <div className="order-mobile-switch">
            <Button
              type={mobileView === "menu" ? "primary" : "default"}
              icon={<AppstoreOutlined />}
              onClick={() => setMobileView("menu")}
            >
              Меню
            </Button>
            <Button
              type={mobileView === "cart" ? "primary" : "default"}
              icon={<ShoppingCartOutlined />}
              onClick={() => setMobileView("cart")}
            >
              Количка ({cartPiecesCount})
            </Button>
          </div>
        )}

        {(!isMobile || mobileView === "menu") && (
          <Row
            gutter={[16, 16]}
            className="order-main-row"
            style={isMobile ? undefined : { flex: 1, minHeight: 0, overflow: "hidden" }}
          >
            {!isMobile && (
              <Col md={6} lg={5} className="order-col-scroll">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  {categories.map((category) => (
                    <div
                      key={category._id}
                      className={`d-flex category ${selectedCategory === category.name && "category-active"}`}
                      style={{
                        width: "100%",
                        marginBottom: 16,
                        background: "#003366",
                        justifyContent: "flex-start",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedCategory(category.name)}
                    >
                      <h4 style={{ color: "white" }}>{category.name}</h4>
                    </div>
                  ))}
                </div>
              </Col>
            )}

            <Col xs={24} md={isMobile ? 24 : 10} lg={isMobile ? 24 : 11} className="order-col-scroll">
              <Input
                allowClear
                size="large"
                className="order-item-search"
                placeholder="Търси артикул..."
                prefix={<SearchOutlined style={{ color: "#888" }} />}
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
              />
              {isMobile && !searchQuery && (
                <div className="order-category-chips">
                  {categories.map((category) => (
                    <button
                      key={category._id}
                      type="button"
                      className={`order-category-chip ${selectedCategory === category.name ? "active" : ""}`}
                      onClick={() => setSelectedCategory(category.name)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              )}
              <Row gutter={[12, 12]}>
                {filteredItems.length === 0 ? (
                  <Col span={24}>
                    <div className="order-item-search-empty">
                      {searchQuery
                        ? `Няма артикул „${itemSearch.trim()}“`
                        : "Няма артикули в тази категория"}
                    </div>
                  </Col>
                ) : (
                  filteredItems.map((item) => (
                    <Col xs={24} sm={12} md={24} lg={12} key={item._id}>
                      <div
                        role="button"
                        tabIndex={0}
                        className="order-product-card"
                        onClick={() => handleAddToCartWithNote(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleAddToCartWithNote(item);
                          }
                        }}
                      >
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#003366",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.name}
                        </span>
                        <span style={{ fontSize: 15, color: "#333", flexShrink: 0 }}>
                          <b>{formatPrice(item.price)}</b>
                        </span>
                      </div>
                    </Col>
                  ))
                )}
              </Row>
            </Col>

            {!isMobile && (
              <Col md={8} lg={8} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <OrderCartPanel
                  isMobile={false}
                  tableName={table.name}
                  pendingItems={pendingItems}
                  cartItems={cartItems}
                  cartTab={cartTab}
                  setCartTab={setCartTab}
                  grandTotal={grandTotal}
                  onChangeQuantity={handleChangeQuantity}
                  onRemove={handleRemoveFromCart}
                  onSendToKitchen={handleSendToKitchen}
                  onGenerateBill={handleGenerateBillClick}
                  getSentStatus={getSentStatus}
                  pendingScrollRef={pendingOrderScrollRef}
                />
              </Col>
            )}
          </Row>
        )}

        {isMobile && mobileView === "cart" && (
          <OrderCartPanel
            isMobile
            tableName={table.name}
            pendingItems={pendingItems}
            cartItems={cartItems}
            cartTab={cartTab}
            setCartTab={setCartTab}
            grandTotal={grandTotal}
            onChangeQuantity={handleChangeQuantity}
            onRemove={handleRemoveFromCart}
            onSendToKitchen={handleSendToKitchen}
            onGenerateBill={handleGenerateBillClick}
            getSentStatus={getSentStatus}
            pendingScrollRef={pendingOrderScrollRef}
          />
        )}
      </div>

      {/* Модален прозорец за създаване на сметка */}
      <Modal
        title="Създай сметка"
        visible={billPopup}
        onCancel={() => setBillPopup(false)}
        footer={false}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitBill} initialValues={{ customerName: table.name, waiter: userData?.name }}>
          <Form.Item name="customerName" label="Маса">
            <Input disabled />
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
              Сума : <b>{formatPrice(grandTotal)}</b>
            </h5>
            <h3>
              Обща сума - <b>{formatPrice(grandTotal)}</b>
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

      <RenameTableModal
        visible={renameTableModalVisible}
        onCancel={() => setRenameTableModalVisible(false)}
        tableId={tableId}
        currentName={table.name}
        onRenamed={handleTableRenamed}
      />

      {/* Модален прозорец за забележка и количество */}
      <Modal
        title={itemToAdd ? `Добави: ${itemToAdd.name}` : "Добави артикул"}
        visible={isNoteModalVisible}
        onOk={handleNoteModalOk}
        onCancel={handleNoteModalCancel}
        footer={
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
            <Button
              onClick={handleNoteModalCancel}
              icon={<CloseOutlined />}
              style={{ minWidth: 48, height: 40, fontSize: 20, borderRadius: 8 }}
            />
            <Button
              type="primary"
              onClick={handleNoteModalOk}
              icon={<CheckOutlined />}
              style={{ minWidth: 48, height: 40, fontSize: 20, borderRadius: 8 }}
            />
          </div>
        }
        style={{ maxWidth: 400, width: '90vw', top: 24, padding: 0 }}
        bodyStyle={{ padding: 16, paddingTop: 8 }}
        centered
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 16 }}>Количество</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              size="large"
              onClick={() => setAddQuantity((q) => Math.max(1, (Number(q) || 1) - 1))}
              style={{ minWidth: 48, height: 44, fontSize: 22, borderRadius: 8 }}
            >
              −
            </Button>
            <InputNumber
              min={1}
              max={99}
              value={addQuantity}
              onChange={(v) => setAddQuantity(Math.max(1, Number(v) || 1))}
              style={{ width: 80, height: 44, fontSize: 20 }}
            />
            <Button
              size="large"
              type="primary"
              onClick={() => setAddQuantity((q) => Math.min(99, (Number(q) || 1) + 1))}
              style={{ minWidth: 48, height: 44, fontSize: 22, borderRadius: 8 }}
            >
              +
            </Button>
          </div>
        </div>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 16 }}>Забележка</div>
        <Input.TextArea
          placeholder="Въведете забележка (по желание)"
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
          autoSize={{ minRows: 3, maxRows: 6 }}
          style={{ fontSize: 18, borderRadius: 8, padding: 8 }}
        />
      </Modal>
    </DefaultLayout>
  );
};

export default Homepage;
