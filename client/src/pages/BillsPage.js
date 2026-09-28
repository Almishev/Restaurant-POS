import React, { useEffect, useState, useRef, useMemo } from "react";
import DefaultLayout from "../components/DefaultLayout";
import { useDispatch } from "react-redux";
import { EyeOutlined } from "@ant-design/icons";
import { useReactToPrint } from "react-to-print";
import axios from "axios";
import {
  Modal,
  Button,
  Table,
  message,
  DatePicker,
  Select,
  Input,
  InputNumber,
  Checkbox,
  Space,
  Tag,
  Statistic,
  Row,
  Col,
} from "antd";
import dayjs from "dayjs";
import "../styles/InvoiceStyles.css";
import { formatPrice } from "../utils/formatPrice";

const { RangePicker } = DatePicker;

const lineKey = (item) => String(item._id || item.itemId || item.name);

const BillsPage = () => {
  const componentRef = useRef();
  const dispatch = useDispatch();
  const [billsData, setBillsData] = useState([]);
  const [popupModal, setPopupModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [servingUserName, setServingUserName] = useState("");
  const [stornoModalVisible, setStornoModalVisible] = useState(false);
  const [billToStorno, setBillToStorno] = useState(null);
  const [stornoReason, setStornoReason] = useState("");
  const [stornoReasonText, setStornoReasonText] = useState("");
  const [stornoLoading, setStornoLoading] = useState(false);
  const [stornoSelection, setStornoSelection] = useState({});

  const [dateRange, setDateRange] = useState([null, null]);
  const [paymentFilter, setPaymentFilter] = useState(undefined);
  const [tableFilter, setTableFilter] = useState("");
  const [includeStornoed, setIncludeStornoed] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("auth");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUserRole(parsedUser?.role || "");
        setUserId(parsedUser?.userId || "");
        setUserName(parsedUser?.name || "");
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);

  const getAllBills = async () => {
    try {
      dispatch({ type: "SHOW_LOADING" });
      const params = { role: userRole, userId };
      if (dateRange[0] && dateRange[1]) {
        params.from = dateRange[0].startOf("day").toISOString();
        params.to = dateRange[1].endOf("day").toISOString();
      }
      if (paymentFilter) params.paymentMode = paymentFilter;
      if (tableFilter.trim()) params.tableName = tableFilter.trim();
      if (includeStornoed) params.includeStornoed = "true";

      const { data } = await axios.get("/api/bills/get-bills", { params });
      setBillsData(data);
      dispatch({ type: "HIDE_LOADING" });
    } catch (error) {
      dispatch({ type: "HIDE_LOADING" });
      message.error(
        error.response?.data?.message || "Грешка при зареждане на сметки"
      );
    }
  };

  useEffect(() => {
    if (userRole) getAllBills();
    // eslint-disable-next-line
  }, [userRole, userId, dateRange, paymentFilter, includeStornoed]);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  });

  const headerTotals = useMemo(() => {
    const active = billsData.filter((b) => !b.isStornoed);
    const sum = active.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
    return { count: active.length, sum, stornoed: billsData.filter((b) => b.isStornoed).length };
  }, [billsData]);

  const openStornoModal = (record) => {
    setBillToStorno(record);
    setStornoReason("");
    setStornoReasonText("");
    const sel = {};
    (record.cartItems || []).forEach((item) => {
      const key = lineKey(item);
      const stornoedMap = record.stornoedQuantities || {};
      const already = Number(stornoedMap[key]) || 0;
      const remaining = Math.max(0, (Number(item.quantity) || 0) - already);
      sel[key] = { checked: remaining > 0, qty: remaining, max: remaining, item };
    });
    setStornoSelection(sel);
    setStornoModalVisible(true);
  };

  const submitStorno = async () => {
    if (!stornoReason) {
      message.error("Моля, изберете причина за сторниране!");
      return;
    }
    const cartItems = Object.values(stornoSelection)
      .filter((s) => s.checked && s.qty > 0)
      .map((s) => ({
        ...s.item,
        quantity: s.qty,
      }));
    if (!cartItems.length) {
      message.error("Изберете поне един артикул и количество!");
      return;
    }
    setStornoLoading(true);
    try {
      dispatch({ type: "SHOW_LOADING" });
      const res = await axios.post("/api/stornos/create-storno", {
        originalBillId: billToStorno._id,
        reason: stornoReason,
        reasonText: stornoReasonText,
        cartItems,
        userId,
        userName: userName || "admin",
      });
      if (res.status === 207) {
        message.warning(res.data.message || "Сторно записано (фискал тест/грешка)");
      } else {
        message.success(res.data.message || "Сторнирането е успешно!");
      }
      setStornoModalVisible(false);
      setBillToStorno(null);
      getAllBills();
    } catch (error) {
      message.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Грешка при сторниране!"
      );
    } finally {
      setStornoLoading(false);
      dispatch({ type: "HIDE_LOADING" });
    }
  };

  const columns = [
    {
      title: "Маса",
      key: "tableName",
      render: (_, record) => record.tableName || record.customerName || "-",
    },
    {
      title: "Дата",
      key: "date",
      render: (_, record) => {
        const d = record.createdAt || record.date;
        if (!d) return "-";
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleString("bg-BG");
      },
    },
    {
      title: "Плащане",
      dataIndex: "paymentMode",
      render: (v) =>
        v === "cash" || v === "Брой" ? "Брой" : v === "card" || v === "Карта" ? "Карта" : v,
    },
    { title: "Обща сума", dataIndex: "totalAmount", render: (v) => formatPrice(v) },
    {
      title: "Статус",
      key: "status",
      render: (_, record) =>
        record.isStornoed ? (
          <Tag color="red">Сторнирана</Tag>
        ) : record.includedInZReport ? (
          <Tag color="blue">В Z отчет</Tag>
        ) : (
          <Tag color="green">Активна</Tag>
        ),
    },
    {
      title: "Действие",
      dataIndex: "_id",
      render: (id, record) => {
        const billDate = new Date(record.createdAt || record.date);
        const timeDiff = Math.abs(new Date() - billDate) / 36e5;
        const canStorno =
          timeDiff <= 24 &&
          userRole === "admin" &&
          !record.isStornoed &&
          !record.includedInZReport;

        return (
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              type="default"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedBill(record);
                setPopupModal(true);
              }}
            >
              Преглед
            </Button>
            {canStorno && (
              <Button type="primary" danger onClick={() => openStornoModal(record)}>
                Сторниране
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  useEffect(() => {
    if (selectedBill && selectedBill.userId) {
      if (selectedBill.userName) {
        setServingUserName(selectedBill.userName);
      } else {
        axios
          .get(`/api/users/get-user/${selectedBill.userId}`)
          .then((res) => setServingUserName(res.data.name))
          .catch(() => setServingUserName(""));
      }
    } else {
      setServingUserName("");
    }
  }, [selectedBill]);

  return (
    <DefaultLayout>
      <div className="d-flex justify-content-between" style={{ marginBottom: 12 }}>
        <h1>Списък с сметки</h1>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <RangePicker value={dateRange} onChange={(v) => setDateRange(v || [null, null])} />
        <Select
          allowClear
          placeholder="Плащане"
          style={{ width: 140 }}
          value={paymentFilter}
          onChange={setPaymentFilter}
          options={[
            { value: "cash", label: "Брой" },
            { value: "card", label: "Карта" },
          ]}
        />
        <Input
          placeholder="Маса"
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          onPressEnter={getAllBills}
          style={{ width: 140 }}
        />
        <Button onClick={getAllBills}>Филтрирай</Button>
        {userRole === "admin" && (
          <Checkbox
            checked={includeStornoed}
            onChange={(e) => setIncludeStornoed(e.target.checked)}
          >
            Покажи сторнирани
          </Checkbox>
        )}
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Statistic title="Активни сметки" value={headerTotals.count} />
        </Col>
        <Col>
          <Statistic title="Оборот" value={headerTotals.sum} precision={2} suffix="€" />
        </Col>
        {includeStornoed && (
          <Col>
            <Statistic title="Сторнирани" value={headerTotals.stornoed} />
          </Col>
        )}
      </Row>

      {userRole !== "admin" && (
        <div
          style={{
            marginBottom: 15,
            padding: 10,
            background: "#f0f8ff",
            border: "1px solid #1890ff",
            borderRadius: 4,
          }}
        >
          Показани са само сметките, издадени от Вас.
        </div>
      )}

      <Table columns={columns} dataSource={billsData} rowKey="_id" bordered />

      {popupModal && selectedBill && (
        <Modal
          width={400}
          title="Сметка"
          visible={popupModal}
          onCancel={() => setPopupModal(false)}
          footer={false}
        >
          <div id="invoice-POS" ref={componentRef}>
            <center id="top">
              <div className="logo" />
              <div className="info">
                <h2>POS Система</h2>
                <p> Контакт : 123456 | Ресторант</p>
              </div>
            </center>
            <div id="mid">
              <div className="mt-2">
                <p>
                  Маса :{" "}
                  <b>{selectedBill.tableName || selectedBill.customerName || "-"}</b>
                  <br />
                  Обслужващ сервитьор:{" "}
                  <b>{servingUserName || selectedBill.userName || "-"}</b>
                  <br />
                  Начин на плащане:{" "}
                  <b>
                    {selectedBill.paymentMode === "cash" || selectedBill.paymentMode === "Брой"
                      ? "В брой"
                      : selectedBill.paymentMode === "card" ||
                        selectedBill.paymentMode === "Карта"
                      ? "Карта"
                      : selectedBill.paymentMode || "-"}
                  </b>
                  <br />
                  Дата :{" "}
                  <b>
                    {selectedBill.date
                      ? new Date(selectedBill.date).toLocaleString("bg-BG")
                      : "-"}
                  </b>
                </p>
                <hr style={{ margin: "5px" }} />
              </div>
            </div>
            <div id="bot">
              <div id="table">
                <table>
                  <tbody>
                    <tr className="tabletitle">
                      <td className="item">
                        <h2>Артикул</h2>
                      </td>
                      <td className="Hours">
                        <h2>Количество</h2>
                      </td>
                      <td className="Rate">
                        <h2>Цена</h2>
                      </td>
                      <td className="Rate">
                        <h2>Общо</h2>
                      </td>
                    </tr>
                    {(selectedBill.cartItems || []).map((item, idx) => (
                      <tr className="service" key={idx}>
                        <td className="tableitem">
                          <p className="itemtext">{item.name}</p>
                        </td>
                        <td className="tableitem">
                          <p className="itemtext">{item.quantity}</p>
                        </td>
                        <td className="tableitem">
                          <p className="itemtext">{formatPrice(item.price)}</p>
                        </td>
                        <td className="tableitem">
                          <p className="itemtext">
                            {formatPrice(item.quantity * item.price)}
                          </p>
                        </td>
                      </tr>
                    ))}
                    <tr className="tabletitle">
                      <td />
                      <td />
                      <td className="Rate">
                        <h2>Обща сума</h2>
                      </td>
                      <td className="payment">
                        <h2>
                          <b>{formatPrice(selectedBill.totalAmount)}</b>
                        </h2>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div id="legalcopy">
                <p className="legal">
                  <strong>Благодарим ви за поръчката!</strong>
                </p>
              </div>
            </div>
          </div>
          <div className="d-flex justify-content-end mt-3">
            <Button type="primary" onClick={handlePrint}>
              Печат
            </Button>
          </div>
        </Modal>
      )}

      <Modal
        title="Сторниране на сметка"
        visible={stornoModalVisible}
        onOk={submitStorno}
        onCancel={() => setStornoModalVisible(false)}
        okText="Сторнирай"
        cancelText="Отказ"
        confirmLoading={stornoLoading}
        width={560}
      >
        <p>Изберете артикули и количество за сторниране (частично или цяло).</p>
        <div style={{ marginTop: 12, marginBottom: 16 }}>
          {Object.entries(stornoSelection).map(([key, s]) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <Checkbox
                checked={s.checked}
                disabled={s.max <= 0}
                onChange={(e) =>
                  setStornoSelection((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], checked: e.target.checked },
                  }))
                }
              />
              <span style={{ flex: 1 }}>{s.item.name}</span>
              <InputNumber
                min={1}
                max={s.max}
                value={s.qty}
                disabled={!s.checked || s.max <= 0}
                onChange={(v) =>
                  setStornoSelection((prev) => ({
                    ...prev,
                    [key]: {
                      ...prev[key],
                      qty: Math.min(s.max, Math.max(1, Number(v) || 1)),
                    },
                  }))
                }
              />
              <span style={{ color: "#888" }}>/ {s.max}</span>
            </div>
          ))}
        </div>
        <label>Причина за сторниране:</label>
        <select
          value={stornoReason}
          onChange={(e) => setStornoReason(e.target.value)}
          style={{ width: "100%", marginTop: 8, marginBottom: 12 }}
        >
          <option value="">-- Изберете причина --</option>
          <option value="operatorError">Операторска грешка</option>
          <option value="returnedItems">Върната стока</option>
          <option value="defectiveGoods">Дефектна стока</option>
          <option value="other">Друго</option>
        </select>
        <Input.TextArea
          placeholder="Допълнителна бележка (по желание)"
          value={stornoReasonText}
          onChange={(e) => setStornoReasonText(e.target.value)}
          rows={2}
        />
      </Modal>
    </DefaultLayout>
  );
};

export default BillsPage;
