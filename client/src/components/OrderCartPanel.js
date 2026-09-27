import React from "react";
import { Table, Button, Tabs } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { formatPrice } from "../utils/formatPrice";

const qtyBtnStyle = {
  minWidth: 44,
  height: 44,
  fontSize: 20,
  borderRadius: 8,
  padding: 0,
};

/**
 * Cart panel for order page — cards on mobile, tables on desktop.
 */
const OrderCartPanel = ({
  isMobile,
  tableName,
  pendingItems,
  cartItems,
  cartTab,
  setCartTab,
  grandTotal,
  onChangeQuantity,
  onRemove,
  onSendToKitchen,
  onGenerateBill,
  getSentStatus,
  pendingScrollRef,
}) => {
  const pendingCards = (
    <div ref={pendingScrollRef}>
      {pendingItems.length === 0 ? (
        <div style={{ color: "#888", padding: 16, textAlign: "center" }}>Няма артикули в текущата поръчка</div>
      ) : (
        pendingItems.map((item) => (
          <div key={item._id} className="cart-item-card" data-row-key={item._id}>
            <div className="cart-item-top">
              <div>
                <div className="cart-item-name">{item.name}</div>
                <div>{formatPrice(item.price)}</div>
                {item.note ? <div style={{ color: "#ff4d4f", marginTop: 4 }}>{item.note}</div> : null}
              </div>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => onRemove(item)}
                style={{ minWidth: 44, height: 44 }}
              />
            </div>
            <div className="cart-qty-row">
              <Button
                className="cart-qty-btn"
                style={qtyBtnStyle}
                onClick={() => onChangeQuantity(item, -1)}
                disabled={item.quantity <= 1}
              >
                −
              </Button>
              <span className="cart-qty-value">{item.quantity}</span>
              <Button
                type="primary"
                className="cart-qty-btn"
                style={qtyBtnStyle}
                onClick={() => onChangeQuantity(item, 1)}
              >
                +
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const sentCards = (
    <div>
      {cartItems.length === 0 ? (
        <div style={{ color: "#888", padding: 16, textAlign: "center" }}>Няма изпратени артикули</div>
      ) : (
        cartItems.map((item) => (
          <div key={item._id} className="cart-item-card" style={{ background: "#f3f3f3" }}>
            <div className="cart-item-top">
              <div>
                <div className="cart-item-name">{item.name}</div>
                <div>
                  {formatPrice(item.price)} × {item.quantity}
                </div>
              </div>
              <div>{getSentStatus(item)}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const cartColumns = [
    { title: "Име", dataIndex: "name" },
    { title: "Цена", dataIndex: "price", render: (price) => formatPrice(price) },
    {
      title: "Количество",
      dataIndex: "quantity",
      render: (quantity, record) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Button style={qtyBtnStyle} onClick={() => onChangeQuantity(record, -1)} disabled={quantity <= 1}>
            −
          </Button>
          <b className="cart-qty-value">{quantity}</b>
          <Button type="primary" style={qtyBtnStyle} onClick={() => onChangeQuantity(record, 1)}>
            +
          </Button>
        </div>
      ),
    },
    {
      title: "Забележка",
      dataIndex: "note",
      render: (note) => (note ? <span style={{ color: "#ff4d4f" }}>{note}</span> : "-"),
    },
    {
      title: "Действие",
      dataIndex: "_id",
      render: (_, record) => (
        <Button
          danger
          icon={<DeleteOutlined style={{ fontSize: 18 }} />}
          onClick={() => onRemove(record)}
          style={{ minWidth: 44, height: 44 }}
        />
      ),
    },
  ];

  const sentColumns = [
    { title: "Име", dataIndex: "name" },
    { title: "Цена", dataIndex: "price", render: (price) => formatPrice(price) },
    { title: "Количество", dataIndex: "quantity" },
    { title: "Статус", render: (_, record) => getSentStatus(record) },
  ];

  return (
    <div className="order-cart-panel" style={{ flex: 1, minHeight: isMobile ? undefined : 0, display: "flex", flexDirection: "column" }}>
      <h3 style={{ flexShrink: 0, marginTop: 0, marginBottom: 8 }}>
        Количка за маса: <b>{tableName}</b>
      </h3>

      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: isMobile ? "visible" : "hidden" }}>
        <Tabs activeKey={cartTab} onChange={setCartTab} size="small" className="order-cart-tabs">
          <Tabs.TabPane tab={`Текуща поръчка (${pendingItems.length})`} key="pending">
            <div
              ref={!isMobile ? pendingScrollRef : undefined}
              style={isMobile ? undefined : { maxHeight: "calc(100vh - 360px)", overflowY: "auto" }}
            >
              {isMobile ? (
                pendingCards
              ) : (
                <Table
                  className="pending-order-table"
                  columns={cartColumns}
                  dataSource={pendingItems}
                  rowKey="_id"
                  pagination={false}
                  bordered
                  size="small"
                />
              )}
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab={`Изпратени (${cartItems.length})`} key="sent">
            <div style={isMobile ? undefined : { maxHeight: "calc(100vh - 360px)", overflowY: "auto" }}>
              {isMobile ? (
                sentCards
              ) : (
                <Table
                  columns={sentColumns}
                  dataSource={cartItems}
                  rowKey="_id"
                  pagination={false}
                  bordered
                  size="small"
                  style={{ background: "#f3f3f3" }}
                  locale={{ emptyText: "Няма изпратени артикули" }}
                />
              )}
            </div>
          </Tabs.TabPane>
        </Tabs>
      </div>

      <div className="order-cart-actions">
        <div style={{ textAlign: "right", marginBottom: 10 }}>
          <h2 style={{ margin: 0, color: "#003366" }}>Общо: {formatPrice(grandTotal)}</h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
            type="default"
            block
            size="large"
            className="btn-mark-order"
            style={{ background: "#A3A7D2", borderRadius: 10, flex: 1, minWidth: 120, fontWeight: 600, minHeight: 48, color: "#003366", borderColor: "#A3A7D2" }}
            onClick={onSendToKitchen}
            disabled={pendingItems.length === 0}
          >
            Маркирай поръчката
          </Button>
          <Button
            type="primary"
            block
            size="large"
            style={{ borderRadius: 10, flex: 1, minWidth: 120, fontWeight: 600, minHeight: 48 }}
            onClick={onGenerateBill}
            disabled={grandTotal === 0}
          >
            Генерирай сметка
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderCartPanel;
