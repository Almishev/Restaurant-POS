import React, { useState, useEffect, useRef } from "react";
import DefaultLayout from "../components/DefaultLayout";
import axios from "axios";
import { Table, DatePicker, Button, Select, Card, Statistic, Row, Col, message, Typography, Empty } from "antd";
import dayjs from "dayjs";
import ReactToPrint from "react-to-print";
import { formatPrice } from "../utils/formatPrice";
import { downloadCsv } from "../utils/downloadCsv";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const ReportsPage = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dates, setDates] = useState([null, null]);
  const [isZ, setIsZ] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const printRef = useRef();

  useEffect(() => {
    const userData = localStorage.getItem("auth");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUserRole(parsedUser?.role || "");
        setCurrentUserId(parsedUser?.userId || "");
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);

  useEffect(() => {
    axios.get("/api/users/get-users").then((res) => setUsers(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (userRole && users.length > 0 && userRole !== "admin" && currentUserId) {
      setSelectedUser(currentUserId);
    }
  }, [userRole, users, currentUserId]);

  useEffect(() => {
    if (dates[0] && dates[1] && dates[0].isSame(dayjs(), "day") && dates[1].isSame(dayjs(), "day")) {
      fetchReport();
    }
    // eslint-disable-next-line
  }, [dates]);

  const fetchReport = async () => {
    setIsZ(false);
    if (!dates[0] || !dates[1]) {
      message.error("Избери период!");
      return;
    }
    setLoading(true);
    try {
      const params = {
        from: dates[0].startOf("day").toISOString(),
        to: dates[1].endOf("day").toISOString(),
      };
      if (selectedUser) params.userId = selectedUser;
      const res = await axios.get("/api/bills/get-report", { params });
      setReport(res.data);
    } catch (error) {
      message.error(error.response?.data?.message || "Грешка при зареждане на отчета!");
    }
    setLoading(false);
  };

  const handleZReport = async () => {
    if (!dates[0] || !dates[1]) {
      message.error("Избери период!");
      return;
    }
    setLoading(true);
    try {
      const body = {
        from: dates[0].startOf("day").toISOString(),
        to: dates[1].endOf("day").toISOString(),
      };
      if (selectedUser) body.userId = selectedUser;
      const res = await axios.post("/api/bills/create-z-report", body);
      setReport(res.data);
      setIsZ(true);
      message.success("Z отчетът е архивиран успешно!");
    } catch (error) {
      message.error(error.response?.data?.message || "Грешка при архивиране на Z отчета!");
    }
    setLoading(false);
  };

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ["Тип", isZ || report.type === "Z" ? "Z" : "X"],
      ["Обща сума", report.totalAmount],
      ["Сторно", report.stornoAmount ?? 0],
      ["Нетен оборот", report.netAmount ?? report.totalAmount],
      ["Брой сметки", report.totalBills],
      ["Брой", report.byPayment?.cash || 0],
      ["Карта", report.byPayment?.card || 0],
      ["На стая", (isZ || report.type === "Z" ? report.roomAmount : report.byPayment?.room) || 0],
      [],
      ["Артикул", "Брой", "Оборот"],
      ...Object.entries(report.items || {}).map(([name, v]) => [name, v.quantity, v.total]),
      [],
      ["Категория", "Брой", "Оборот"],
      ...Object.entries(report.byCategory || {}).map(([name, v]) => [name, v.quantity, v.total]),
    ];
    downloadCsv(`report-${dayjs().format("YYYYMMDD-HHmm")}.csv`, rows);
  };

  const columns = [
    { title: "Дата", dataIndex: "date", render: (d) => new Date(d).toLocaleString() },
    { title: "Сума", dataIndex: "totalAmount", render: (v) => formatPrice(v) },
    { title: "Плащане", dataIndex: "paymentMode" },
  ];

  return (
    <DefaultLayout>
      <Card title="X/Z отчет" style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col>
            <RangePicker value={dates} onChange={setDates} format="YYYY-MM-DD" style={{ minWidth: 220 }} />
          </Col>
          <Col>
            <Select
              allowClear={userRole === "admin"}
              placeholder="Сервитьор (по избор)"
              style={{ minWidth: 180 }}
              value={selectedUser}
              onChange={setSelectedUser}
              disabled={userRole !== "admin"}
            >
              {users.map((u) => (
                <Select.Option key={u._id} value={u.userId}>
                  {u.name || u.userId}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Button
              onClick={() => {
                setDates([dayjs().startOf("day"), dayjs().endOf("day")]);
                if (userRole === "admin") setSelectedUser(null);
              }}
            >
              Дневен отчет
            </Button>
          </Col>
          <Col>
            <Button type="primary" onClick={fetchReport} loading={loading}>
              Генерирай X отчет
            </Button>
          </Col>
          {userRole === "admin" && (
            <Col>
              <Button type="primary" danger onClick={handleZReport} loading={loading}>
                Архивирай Z отчет
              </Button>
            </Col>
          )}
          <Col>
            {report && (
              <ReactToPrint
                trigger={() => <Button type="default">Печат</Button>}
                content={() => printRef.current}
              />
            )}
          </Col>
          <Col>{report && <Button onClick={exportCsv}>Експорт CSV</Button>}</Col>
        </Row>
      </Card>
      <div ref={printRef} style={{ background: "white", padding: 24 }}>
        {report ? (
          <>
            <Title level={3} style={{ textAlign: "center" }}>
              {isZ || report.type === "Z" ? "Z отчет (архивиран)" : "X отчет (справка)"}
            </Title>
            {report.createdAt && (
              <Text type="secondary">Архивиран на: {new Date(report.createdAt).toLocaleString()}</Text>
            )}
            <Row gutter={16} style={{ marginBottom: 24, marginTop: 16 }}>
              <Col>
                <Statistic title="Бруто" value={Number(report.totalAmount) || 0} precision={2} suffix="€" />
              </Col>
              <Col>
                <Statistic title="Сторно" value={Number(report.stornoAmount) || 0} precision={2} suffix="€" />
              </Col>
              <Col>
                <Statistic
                  title="Нетен оборот"
                  value={Number(report.netAmount ?? report.totalAmount) || 0}
                  precision={2}
                  suffix="€"
                />
              </Col>
              <Col>
                <Statistic title="Брой сметки" value={report.totalBills} />
              </Col>
              <Col>
                <Statistic title="Брой" value={Number(report.byPayment?.cash) || 0} precision={2} suffix="€" />
              </Col>
              <Col>
                <Statistic title="Карта" value={Number(report.byPayment?.card) || 0} precision={2} suffix="€" />
              </Col>
              <Col>
                <Statistic
                  title={isZ || report.type === "Z" ? "На стая (извън Z)" : "На стая"}
                  value={
                    Number(isZ || report.type === "Z" ? report.roomAmount : report.byPayment?.room) || 0
                  }
                  precision={2}
                  suffix="€"
                />
              </Col>
            </Row>
            <Card title="Разбивка по артикули" style={{ marginBottom: 24 }}>
              <Table
                dataSource={Object.entries(report.items || {}).map(([name, v], i) => ({ key: i, name, ...v }))}
                columns={[
                  { title: "Артикул", dataIndex: "name" },
                  { title: "Брой", dataIndex: "quantity" },
                  { title: "Оборот", dataIndex: "total", render: (v) => formatPrice(v) },
                ]}
                pagination={false}
                size="small"
              />
            </Card>
            {report.byCategory && Object.keys(report.byCategory).length > 0 && (
              <Card title="По категория" style={{ marginBottom: 24 }}>
                <Table
                  dataSource={Object.entries(report.byCategory).map(([name, v], i) => ({ key: i, name, ...v }))}
                  columns={[
                    { title: "Категория", dataIndex: "name" },
                    { title: "Брой", dataIndex: "quantity" },
                    { title: "Оборот", dataIndex: "total", render: (v) => formatPrice(v) },
                  ]}
                  pagination={false}
                  size="small"
                />
              </Card>
            )}
            {report.byHour && (
              <Card title="По час" style={{ marginBottom: 24 }}>
                <Table
                  dataSource={Object.entries(report.byHour)
                    .filter(([, v]) => v.count > 0 || v.amount > 0)
                    .map(([hour, v]) => ({ key: hour, hour: `${hour}:00`, count: v.count, amount: v.amount }))}
                  columns={[
                    { title: "Час", dataIndex: "hour" },
                    { title: "Сметки", dataIndex: "count" },
                    { title: "Оборот", dataIndex: "amount", render: (v) => formatPrice(v) },
                  ]}
                  pagination={false}
                  size="small"
                />
              </Card>
            )}
            <Card title="Всички сметки">
              <Table dataSource={report.bills} columns={columns} rowKey="_id" size="small" />
            </Card>
            {(report.preBillStornos || []).length > 0 && (
              <Card title="Сторнирани преди сметка (изпратени)" style={{ marginTop: 24 }}>
                <Table
                  size="small"
                  rowKey="_id"
                  dataSource={report.preBillStornos}
                  columns={[
                    {
                      title: "Дата",
                      dataIndex: "createdAt",
                      render: (d) => new Date(d).toLocaleString(),
                    },
                    { title: "Сервитьор", dataIndex: "userName" },
                    { title: "Маса", dataIndex: "tableName" },
                    {
                      title: "Артикули",
                      key: "items",
                      render: (_, r) =>
                        (r.cartItems || [])
                          .map((i) => `${i.name}×${i.quantity}`)
                          .join(", "),
                    },
                    {
                      title: "Сума",
                      dataIndex: "totalAmount",
                      render: (v) => formatPrice(v),
                    },
                    { title: "Причина", dataIndex: "reason" },
                  ]}
                />
              </Card>
            )}
          </>
        ) : (
          <Empty description="Няма данни за избрания период" style={{ marginTop: 48 }} />
        )}
      </div>
    </DefaultLayout>
  );
};

export default ReportsPage;
