import React, { useState, useEffect, useRef } from "react";
import DefaultLayout from "../components/DefaultLayout";
import axios from "axios";
import { Table, DatePicker, Button, Select, Card, Statistic, Row, Col, message, Typography, Empty } from "antd";
import dayjs from "dayjs";
import ReactToPrint from "react-to-print";
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const ReportsPage = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dates, setDates] = useState([null, null]);  const [isZ, setIsZ] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const printRef = useRef();

  useEffect(() => {
    // Get user role and ID from localStorage
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
    // Зареди всички потребители за филтър по сервитьор
    const fetchUsers = async () => {
      try {
        const res = await axios.get("/api/users/get-users");
        setUsers(res.data);
      } catch {}
    };
    fetchUsers();
  }, []);

  // Когато потребителската роля е заредена, автоматично избираме текущия потребител ако не е админ
  useEffect(() => {
    if (userRole && users.length > 0) {
      if (userRole !== "admin" && currentUserId) {
        // За не-admin потребители, директно използваме техния userId (string идентификатор)
        // вместо MongoDB ObjectId
        console.log(`Автоматично избиране на текущия потребител: ${currentUserId}`);
        
        // Директно използваме userId-то, а не MongoDB _id
        setSelectedUser(currentUserId);
      }
    }
  }, [userRole, users, currentUserId]);

  // Поправям 'Дневен отчет' - когато датите се сменят, автоматично викай fetchReport ако е дневен отчет
  useEffect(() => {
    if (dates[0] && dates[1] && dates[0].isSame(dayjs(), 'day') && dates[1].isSame(dayjs(), 'day')) {
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
      
      // Debug: Print userId before making request
      console.log(`Текущ потребител: роля=${userRole}, id=${currentUserId}`);
      console.log(`Избран потребител за отчет: ${selectedUser || 'всички'}`);
      
      if (selectedUser) {
        params.userId = selectedUser;
        console.log(`Ще се филтрира по потребител с ID: ${selectedUser}`);
      }
      
      console.log("Изпращане на заявка за отчет с параметри:", params);
      
      const res = await axios.get("/api/bills/get-report", { params });
      console.log("Получен отчет:", res.data);
      
      if (res.data.totalAmount === 0) {
        console.log("ВНИМАНИЕ: Отчетът върна сума 0 - проверка на резултата:", {
          totalBills: res.data.totalBills,
          items: Object.keys(res.data.items || {}).length
        });
      }
      
      setReport(res.data);
    } catch (error) {
      console.error("Грешка при зареждане на отчета:", error);
      message.error("Грешка при зареждане на отчета!");
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
      const msg = error.response?.data?.message || "Грешка при архивиране на Z отчета!";
      message.error(msg);
    }
    setLoading(false);
  };

  const columns = [
    { title: "Дата", dataIndex: "date", render: d => new Date(d).toLocaleString() },
    { title: "Маса/Клиент", dataIndex: "customerName" },
    { title: "Сума", dataIndex: "totalAmount" },
    { title: "Плащане", dataIndex: "paymentMode" },
  ];

  // Печат
  const PrintButton = () => (
    <ReactToPrint
      trigger={() => <Button type="default">Печат</Button>}
      content={() => printRef.current}
    />
  );

  return (
    <DefaultLayout>
      <Card title="X/Z отчет" style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col>
            <RangePicker
              value={dates}
              onChange={setDates}
              format="YYYY-MM-DD"
              style={{ minWidth: 220 }}
            />
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
              {users.map(u => (
                <Select.Option key={u._id} value={u.userId}>{u.name || u.userId}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Button
              onClick={() => {
                const today = [dayjs().startOf("day"), dayjs().endOf("day")];
                setDates(today);
                if (userRole === "admin") {
                  setSelectedUser(null);
                }
              }}
            >
              Дневен отчет
            </Button>
          </Col>          <Col>
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
            {report && <PrintButton />}
          </Col>
        </Row>
      </Card>
      {/* Визуализация на отчета */}
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
              <Col><Statistic title="Обща сума" value={report.totalAmount} suffix="лв" /></Col>
              <Col><Statistic title="Брой сметки" value={report.totalBills} /></Col>
              <Col><Statistic title="Плащане в брой" value={report.byPayment?.cash || 0} suffix="лв" /></Col>
              <Col><Statistic title="Плащане с карта" value={report.byPayment?.card || 0} suffix="лв" /></Col>
            </Row>
            <Card title="Разбивка по артикули" style={{ marginBottom: 24 }}>
              <Table
                dataSource={Object.entries(report.items || {}).map(([name, v], i) => ({ key: i, name, ...v }))}
                columns={[
                  { title: "Артикул", dataIndex: "name" },
                  { title: "Брой", dataIndex: "quantity" },
                  { title: "Оборот", dataIndex: "total", render: v => v + " лв" },
                ]}
                pagination={false}
                size="small"
                locale={{ emptyText: "Няма артикули за периода" }}
              />
            </Card>
            <Card title="Всички сметки">
              <Table
                dataSource={report.bills}
                columns={columns}
                rowKey="_id"
                size="small"
                locale={{ emptyText: "Няма сметки за периода" }}
              />
            </Card>
          </>
        ) : (
          <Empty description="Няма данни за избрания период" style={{ marginTop: 48 }} />
        )}
      </div>
    </DefaultLayout>
  );
};

export default ReportsPage;