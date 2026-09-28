import React, { useState, useEffect, useCallback, useRef } from "react";
import DefaultLayout from "./../components/DefaultLayout";
import axios from "axios";
import { Row, Col, message, Button, Modal, Form, Input, InputNumber, Select, Dropdown, Menu } from "antd";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircleTwoTone, CloseOutlined, CheckOutlined, ShoppingCartOutlined, AppstoreOutlined, DownOutlined, SearchOutlined, PlusOutlined, MinusOutlined } from '@ant-design/icons';
import TransferItemsModal from "../components/TransferItemsModal";
import TransferTableModal from "../components/TransferTableModal";
import RenameTableModal from "../components/RenameTableModal";
import OrderCartPanel from "../components/OrderCartPanel";
import { formatPrice } from "../utils/formatPrice";
import { mergeLineItems } from "../utils/mergeLineItems";
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
  const [sentStornoItem, setSentStornoItem] = useState(null);
  const [sentStornoQty, setSentStornoQty] = useState(1);
  const [sentStornoReason, setSentStornoReason] = useState("operatorError");
  const [sentStornoLoading, setSentStornoLoading] = useState(false);
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
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
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
        const mergedPending = mergeLineItems(foundTable.pendingItems || []);
        const mergedCart = mergeLineItems(foundTable.cartItems || []);
        setTable(foundTable);
        setPendingItems(mergedPending);
        setCartItems(mergedCart);
        setTotalAmount(foundTable.totalAmount || 0);

        // Persist merged lines if DB still had duplicates
        const pendingDup =
          (foundTable.pendingItems || []).length !== mergedPending.length;
        const cartDup = (foundTable.cartItems || []).length !== mergedCart.length;
        if (pendingDup || cartDup) {
          try {
            if (cartDup) {
              await axios.put("/api/tables/update-table-cart", {
                tableId,
                cartItems: mergedCart,
                totalAmount: foundTable.totalAmount || 0,
              });
            }
            if (pendingDup) {
              await axios.put("/api/tables/update-table-pending-items", {
                tableId,
                pendingItems: mergedPending,
                totalAmount: foundTable.totalAmount || 0,
              });
            }
          } catch (e) {
            console.error("Грешка при обединяване на дублирани артикули:", e);
          }
        }
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
        setPendingItems((prev) => {
          const next = mergeLineItems(foundTable.pendingItems || []);
          return sameItems(prev, next) ? prev : next;
        });
        setCartItems((prev) => {
          const next = mergeLineItems(foundTable.cartItems || []);
          return sameItems(prev, next) ? prev : next;
        });
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

  // Добавяне на артикул към pendingItems с модал за забележка (long-press / desktop)
  const handleAddToCartWithNote = (item, options = {}) => {
    setItemToAdd(item);
    const existing = pendingItems.find((i) => i._id === item._id);
    setNoteValue(existing?.note || "");
    // Long-press on existing: note edit (0 extra). Otherwise add at least 1.
    setAddQuantity(options.noteFocus && existing ? 0 : 1);
    setIsNoteModalVisible(true);
  };

  const handleQuickAdd = async (item) => {
    const existing = pendingItems.find((i) => i._id === item._id);
    let updatedPending;
    if (existing) {
      updatedPending = pendingItems.map((i) =>
        i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i
      );
    } else {
      updatedPending = [...pendingItems, { ...item, quantity: 1, note: "" }];
    }
    await updatePendingInDB(updatedPending);
  };

  const handleQuickDec = async (item) => {
    const existing = pendingItems.find((i) => i._id === item._id);
    if (!existing) return;
    let updatedPending;
    if (existing.quantity <= 1) {
      updatedPending = pendingItems.filter((i) => i._id !== item._id);
    } else {
      updatedPending = pendingItems.map((i) =>
        i._id === item._id ? { ...i, quantity: i.quantity - 1 } : i
      );
    }
    await updatePendingInDB(updatedPending);
  };

  const getPendingQty = (itemId) =>
    pendingItems.find((i) => i._id === itemId)?.quantity || 0;

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = (item) => {
    longPressFiredRef.current = false;
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      handleAddToCartWithNote(item, { noteFocus: true });
    }, 500);
  };

  const handleNoteModalOk = async () => {
    if (!itemToAdd) {
      setIsNoteModalVisible(false);
      return;
    }
    const extraQty = Math.max(0, Number(addQuantity) || 0);
    const existing = pendingItems.find((i) => i._id === itemToAdd._id);
    let updatedPending;
    if (existing) {
      const add = extraQty > 0 ? extraQty : 0;
      updatedPending = pendingItems.map((i) =>
        i._id === itemToAdd._id
          ? {
              ...i,
              quantity: i.quantity + add,
              note: noteValue,
            }
          : i
      );
    } else {
      const qty = Math.max(1, extraQty || 1);
      updatedPending = [
        ...pendingItems,
        { ...itemToAdd, quantity: qty, note: noteValue },
      ];
    }
    await updatePendingInDB(updatedPending);
    setIsNoteModalVisible(false);
    setNoteValue("");
    setAddQuantity(1);
    setItemToAdd(null);
    setCartTab("pending");
    // Stay on menu on mobile (competitor UX); desktop cart is always visible
    if (!isMobile) {
      scrollToPendingItem(itemToAdd._id);
    }
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
      
      // Merge with existing sent items so same products become one line with summed qty
      const mergedCart = mergeLineItems([
        ...(table.cartItems || []),
        ...itemsWithStatus,
      ]);

      await axios.put("/api/tables/update-table-cart", {
        tableId,
        cartItems: mergedCart,
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
      // kitchenOrders matching by name for live updates
      const fromKitchen = (kitchenOrders || []).some((o) =>
        (o.items || []).some(
          (it) =>
            it.done &&
            (it.name || "").toLowerCase().trim() === (record.name || "").toLowerCase().trim() &&
            o.tableName === table?.name
        )
      );
      if (fromKitchen) {
        return <span style={{ color: 'green' }}><CheckCircleTwoTone twoToneColor="#52c41a" /> Готово</span>;
      }
      return <span style={{ color: '#888' }}>Изпратено</span>;
  };

  const openSentStorno = (item) => {
    const issued =
      item.status === "Готово" ||
      (kitchenOrders || []).some(
        (o) =>
          o.tableName === table?.name &&
          (o.items || []).some(
            (it) =>
              it.done &&
              (it.name || "").toLowerCase().trim() ===
                (item.name || "").toLowerCase().trim()
          )
      );
    if (issued) {
      message.warning(
        "Издаден артикул не може да се сторнира. Кухнята/барът трябва да натиснат „Върни“."
      );
      return;
    }
    setSentStornoItem(item);
    setSentStornoQty(1);
    setSentStornoReason("operatorError");
  };

  const submitSentStorno = async () => {
    if (!sentStornoItem || !tableId) return;
    setSentStornoLoading(true);
    try {
      const auth = localStorage.getItem("auth")
        ? JSON.parse(localStorage.getItem("auth"))
        : {};
      const res = await axios.post("/api/stornos/create-pre-bill-storno", {
        tableId,
        itemId: sentStornoItem._id,
        quantity: sentStornoQty,
        reason: sentStornoReason,
        userId: auth.userId,
        userName: auth.name || auth.userId,
      });
      message.success(res.data.message || "Сторнирано");
      if (res.data.table) {
        setCartItems(mergeLineItems(res.data.table.cartItems || []));
        setPendingItems(mergeLineItems(res.data.table.pendingItems || []));
        setTable(res.data.table);
      } else {
        await fetchTable();
      }
      setSentStornoItem(null);
    } catch (e) {
      message.error(e.response?.data?.error || "Грешка при сторно");
    } finally {
      setSentStornoLoading(false);
    }
  };

  // Изчисли общата сума за всички артикули (изпратени + текущи)
  const grandTotal = [...cartItems, ...pendingItems].reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Общ брой бройки (не само видове артикули)
  const cartPiecesCount = [...cartItems, ...pendingItems].reduce(
    (sum, i) => sum + (Number(i.quantity) || 0),
    0
  );
  const pendingPiecesCount = pendingItems.reduce(
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

        {isMobile && mobileView === "menu" && (
          <div className="order-mobile-menu">
            <div className="order-mobile-split">
              {!searchQuery && (
                <aside className="order-mobile-cats">
                  {categories.map((category) => (
                    <button
                      key={category._id}
                      type="button"
                      className={`order-mobile-cat ${selectedCategory === category.name ? "active" : ""}`}
                      onClick={() => setSelectedCategory(category.name)}
                    >
                      {category.name}
                    </button>
                  ))}
                </aside>
              )}
              <div className="order-mobile-items">
                <Input
                  allowClear
                  size="large"
                  className="order-item-search"
                  placeholder="Търси артикул..."
                  prefix={<SearchOutlined style={{ color: "#888" }} />}
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                />
                <div className="order-mobile-item-list">
                  {filteredItems.length === 0 ? (
                    <div className="order-item-search-empty">
                      {searchQuery
                        ? `Няма артикул „${itemSearch.trim()}“`
                        : "Няма артикули в тази категория"}
                    </div>
                  ) : (
                    filteredItems.map((item) => {
                      const qty = getPendingQty(item._id);
                      return (
                        <div
                          key={item._id}
                          className="order-mobile-item-row"
                          onTouchStart={() => startLongPress(item)}
                          onTouchEnd={clearLongPress}
                          onTouchMove={clearLongPress}
                          onTouchCancel={clearLongPress}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            handleAddToCartWithNote(item, { noteFocus: true });
                          }}
                        >
                          <div className="order-mobile-item-info">
                            <span className="order-mobile-item-name">{item.name}</span>
                            <span className="order-mobile-item-price">{formatPrice(item.price)}</span>
                          </div>
                          <div className="order-mobile-item-qty">
                            <Button
                              className="order-mobile-qty-btn"
                              icon={<MinusOutlined />}
                              disabled={qty === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                clearLongPress();
                                handleQuickDec(item);
                              }}
                              onTouchStart={(e) => e.stopPropagation()}
                            />
                            <span className="order-mobile-qty-value">{qty}</span>
                            <Button
                              type="primary"
                              className="order-mobile-qty-btn"
                              icon={<PlusOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                clearLongPress();
                                if (longPressFiredRef.current) {
                                  longPressFiredRef.current = false;
                                  return;
                                }
                                handleQuickAdd(item);
                              }}
                              onTouchStart={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="order-mobile-done-bar">
              <Button
                type="primary"
                size="large"
                block
                className="order-mobile-done-btn"
                icon={<ShoppingCartOutlined />}
                onClick={() => {
                  setCartTab("pending");
                  setMobileView("cart");
                }}
              >
                Готово
                {pendingPiecesCount > 0 && (
                  <span className="order-mobile-done-badge">{pendingPiecesCount}</span>
                )}
              </Button>
            </div>
          </div>
        )}

        {!isMobile && (
          <Row
            gutter={[16, 16]}
            className="order-main-row"
            style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
          >
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

            <Col md={10} lg={11} className="order-col-scroll">
              <Input
                allowClear
                size="large"
                className="order-item-search"
                placeholder="Търси артикул..."
                prefix={<SearchOutlined style={{ color: "#888" }} />}
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
              />
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
                    <Col sm={12} md={24} lg={12} key={item._id}>
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
                onEditNote={(item) => handleAddToCartWithNote(item, { noteFocus: true })}
                onStornoSent={openSentStorno}
                onSendToKitchen={handleSendToKitchen}
                onGenerateBill={handleGenerateBillClick}
                getSentStatus={getSentStatus}
                pendingScrollRef={pendingOrderScrollRef}
              />
            </Col>
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
            onEditNote={(item) => handleAddToCartWithNote(item, { noteFocus: true })}
            onStornoSent={openSentStorno}
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
        title={itemToAdd ? `Забележка: ${itemToAdd.name}` : "Добави артикул"}
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
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 16 }}>
            {isMobile ? "Допълнително количество" : "Количество"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              size="large"
              onClick={() => setAddQuantity((q) => Math.max(0, (Number(q) || 0) - 1))}
              style={{ minWidth: 48, height: 44, fontSize: 22, borderRadius: 8 }}
            >
              −
            </Button>
            <InputNumber
              min={0}
              max={99}
              value={addQuantity}
              onChange={(v) => setAddQuantity(Math.max(0, Number(v) || 0))}
              style={{ width: 80, height: 44, fontSize: 20 }}
            />
            <Button
              size="large"
              type="primary"
              onClick={() => setAddQuantity((q) => Math.min(99, (Number(q) || 0) + 1))}
              style={{ minWidth: 48, height: 44, fontSize: 22, borderRadius: 8 }}
            >
              +
            </Button>
          </div>
        </div>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 16 }}>Забележка</div>
        <Input.TextArea
          placeholder={
            isMobile
              ? "Забележка (дълго натискане на реда)"
              : "Въведете забележка (по желание)"
          }
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
          autoSize={{ minRows: 3, maxRows: 6 }}
          style={{ fontSize: 18, borderRadius: 8, padding: 8 }}
        />
      </Modal>
      {/* Pre-bill сторно на изпратен артикул */}
      <Modal
        title={sentStornoItem ? `Сторно: ${sentStornoItem.name}` : "Сторно"}
        visible={!!sentStornoItem}
        onCancel={() => setSentStornoItem(null)}
        onOk={submitSentStorno}
        confirmLoading={sentStornoLoading}
        okText="Сторнирай"
        cancelText="Отказ"
        okButtonProps={{ danger: true }}
      >
        {sentStornoItem && (
          <>
            <p>
              Маха се от изпратените и се маха от кухнята/бара (ако още не е
              издадено).
            </p>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Количество</div>
              <InputNumber
                min={1}
                max={Number(sentStornoItem.quantity) || 1}
                value={sentStornoQty}
                onChange={(v) =>
                  setSentStornoQty(
                    Math.min(
                      Number(sentStornoItem.quantity) || 1,
                      Math.max(1, Number(v) || 1)
                    )
                  )
                }
              />
              <span style={{ marginLeft: 8 }}>
                / {sentStornoItem.quantity}
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Причина</div>
              <Select
                style={{ width: "100%" }}
                value={sentStornoReason}
                onChange={setSentStornoReason}
              >
                <Select.Option value="operatorError">Операторска грешка</Select.Option>
                <Select.Option value="returnedItems">Върната стока</Select.Option>
                <Select.Option value="defectiveGoods">Дефектна стока</Select.Option>
                <Select.Option value="other">Друго</Select.Option>
              </Select>
            </div>
          </>
        )}
      </Modal>
    </DefaultLayout>
  );
};

export default Homepage;
