import React, { useState, useEffect } from "react";
import DefaultLayout from "../components/DefaultLayout";
import { useDispatch } from "react-redux";
import { 
  Button, 
  Table, 
  DatePicker, 
  message, 
  Row, 
  Col, 
  Card,
  Typography,
  Badge,
  Modal,
  Descriptions,
  Statistic
} from "antd";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const StornoListPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [stornos, setStornos] = useState([]);
  const [selectedStorno, setSelectedStorno] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [originalBill, setOriginalBill] = useState(null);
  
  // Данни за филтриране
  const [dateRange, setDateRange] = useState([]);
  
  // Състояние за зареждане на потребителски данни
  const [userData, setUserData] = useState(null);

  // При зареждане на компонента
  useEffect(() => {
    const userDataStr = localStorage.getItem("auth");
    if (userDataStr) {
      try {
        const parsedUserData = JSON.parse(userDataStr);
        setUserData(parsedUserData);
        getAllStornos(parsedUserData).then(() => {
          // Ако имаме stornoId в location, отваряме детайлите
          if (location.state?.stornoId) {
            setTimeout(() => {
              // Търсим сторно операцията с този ID
              const storno = stornos.find(s => s._id === location.state.stornoId);
              if (storno) {
                viewStornoDetails(storno);
              }
            }, 500); // Малко закъснение, за да се заредят данните
          }
        });
      } catch (error) {
        console.log("Error parsing user data:", error);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Зареждане на сторно операциите
  const getAllStornos = async (user) => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      
      const params = {};
      if (dateRange.length === 2) {
        params.startDate = dateRange[0].toISOString();
        params.endDate = dateRange[1].toISOString();
      }
      
      // Винаги подавай userId и role
      if (user) {
        params.userId = user.userId;
        params.role = user.role;
      }
      
      const { data } = await axios.get("/api/stornos/get-stornos", { params });
      
      setStornos(data);
      dispatch({
        type: "HIDE_LOADING",
      });
    } catch (error) {
      dispatch({
        type: "HIDE_LOADING",
      });
      message.error("Възникна грешка при зареждане на данни за сторно операциите");
      console.log(error);
    }
  };

  // Филтриране по дата
  const handleDateFilter = (dates) => {
    setDateRange(dates || []);
    if (userData) {
      getAllStornos(userData);
    }
  };

  // Отваряне на детайлите за сторно операцията
  const viewStornoDetails = async (storno) => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      
      setSelectedStorno(storno);
      
      // Зареждане на оригиналния бон
      const { data } = await axios.get(`/api/stornos/get-storno/${storno._id}`);
      
      setOriginalBill(data.originalBill);
      setDetailsModalVisible(true);
      
      dispatch({
        type: "HIDE_LOADING",
      });
    } catch (error) {
      dispatch({
        type: "HIDE_LOADING",
      });
      message.error("Грешка при зареждане на детайли за сторно операцията");
      console.log(error);
    }
  };
  
  // Превод на причината за сторниране
  const translateReason = (reason) => {
    const reasons = {
      operatorError: "Операторска грешка",
      returnedItems: "Върната стока",
      defectiveGoods: "Дефектна стока",
      other: "Друго"
    };
    return reasons[reason] || reason;
  };
  
  // Превод на статуса на фискализация
  const translateFiscalStatus = (status) => {
    const statuses = {
      pending: "В изчакване",
      completed: "Завършена",
      error: "Грешка"
    };
    return statuses[status] || status;
  };
  
  // Функция за определяне на цвета на статуса
  const getStatusColor = (status) => {
    const colors = {
      pending: "warning",
      completed: "success",
      error: "error"
    };
    return colors[status] || "default";
  };

  // Колони за таблицата със сторно операции
  const columns = [
    {
      title: "ID",
      dataIndex: "_id",
      render: (id) => <span>{id.toString().substring(18, 24)}</span>
    },
    {
      title: "ID на оригинален бон",
      dataIndex: "originalBillId",
      render: (id) => <span>{id.toString().substring(18, 24)}</span>
    },
    {
      title: "Клиент",
      dataIndex: "customerName",
      render: (name) => <span>{name || "Няма данни"}</span>
    },
    {
      title: "Причина",
      dataIndex: "reason",
      render: (reason) => <span>{translateReason(reason)}</span>
    },
    {
      title: "Артикули",
      dataIndex: "cartItems",
      render: (items) => <span>{items.length}</span>
    },
    {
      title: "Общо",
      dataIndex: "totalAmount",
      render: (amount) => <span>{amount.toFixed(2)} лв.</span>
    },
    {
      title: "Потребител",
      dataIndex: "userName",
    },
    {
      title: "Статус на фискализация",
      dataIndex: "fiscalStatus",
      render: (status) => (
        <Badge status={getStatusColor(status)} text={translateFiscalStatus(status)} />
      )
    },
    {
      title: "Създадена",
      dataIndex: "createdAt",
      render: (date) => <span>{new Date(date).toLocaleString()}</span>,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    },
    {
      title: "Действия",
      render: (_, record) => (
        <Button 
          type="primary" 
          onClick={() => viewStornoDetails(record)}
        >
          Детайли
        </Button>
      )
    }
  ];

  return (
    <DefaultLayout>
      <div className="d-flex justify-content-between mb-3">
        <Title level={3}>Сторно операции</Title>
        <div>
          <Button type="primary" onClick={() => navigate("/storno")} style={{ marginRight: '8px' }}>
            Ново сторно
          </Button>
          <Button type="default" onClick={() => navigate("/storno-report")}>
            Отчет сторно
          </Button>
        </div>
      </div>

      <Card className="mb-3">
        <Title level={5}>Филтри</Title>
        <Row>
          <Col span={8}>
            <Text strong>Период</Text>
            <RangePicker 
              style={{ width: '100%', marginTop: 8 }}
              onChange={handleDateFilter}
            />
          </Col>
        </Row>
      </Card>

      {stornos.length > 0 && (
        <Row gutter={16} className="mb-3">
          <Col span={8}>
            <Card>
              <Statistic 
                title="Общ брой сторно операции" 
                value={stornos.length} 
                precision={0}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic 
                title="Обща сума на сторно операциите" 
                value={stornos.reduce((sum, storno) => sum + storno.totalAmount, 0)} 
                precision={2}
                suffix="лв."
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic 
                title="Средна стойност" 
                value={stornos.length ? (stornos.reduce((sum, storno) => sum + storno.totalAmount, 0) / stornos.length) : 0} 
                precision={2}
                suffix="лв."
              />
            </Card>
          </Col>
        </Row>
      )}

      <Table
        columns={columns} 
        dataSource={stornos} 
        bordered 
        rowKey="_id"
        pagination={{ pageSize: 10 }}
      />
      
      {/* Модален прозорец с детайли за сторно операцията */}
      {selectedStorno && (
        <Modal
          title="Детайли за сторно операцията"
          visible={detailsModalVisible}
          onCancel={() => {
            setDetailsModalVisible(false);
            setSelectedStorno(null);
            setOriginalBill(null);
          }}
          footer={[
            <Button key="back" onClick={() => {
              setDetailsModalVisible(false);
              setSelectedStorno(null);
              setOriginalBill(null);
            }}>
              Затвори
            </Button>
          ]}
          width={800}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Card title="Информация за сторно операцията" bordered={false}>
                <Descriptions layout="vertical" column={1}>
                  <Descriptions.Item label="Сторно ID">{selectedStorno._id.substring(18, 24)}</Descriptions.Item>
                  <Descriptions.Item label="Дата на създаване">{new Date(selectedStorno.createdAt).toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="Причина">{translateReason(selectedStorno.reason)}</Descriptions.Item>
                  {selectedStorno.reasonText && (
                    <Descriptions.Item label="Допълнителна информация">{selectedStorno.reasonText}</Descriptions.Item>
                  )}
                  <Descriptions.Item label="Потребител">{selectedStorno.userName}</Descriptions.Item>
                  <Descriptions.Item label="Статус на фискализация">
                    <Badge status={getStatusColor(selectedStorno.fiscalStatus)} text={translateFiscalStatus(selectedStorno.fiscalStatus)} />
                  </Descriptions.Item>
                  {selectedStorno.fiscalReceiptId && (
                    <Descriptions.Item label="Фискален номер">{selectedStorno.fiscalReceiptId}</Descriptions.Item>
                  )}
                  {selectedStorno.fiscalErrorMessage && (
                    <Descriptions.Item label="Грешка при фискализация">{selectedStorno.fiscalErrorMessage}</Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Информация за оригиналния бон" bordered={false}>
                {originalBill ? (
                  <Descriptions layout="vertical" column={1}>
                    <Descriptions.Item label="Бон ID">{originalBill._id.substring(18, 24)}</Descriptions.Item>
                    <Descriptions.Item label="Дата на създаване">{new Date(originalBill.createdAt || originalBill.date).toLocaleString()}</Descriptions.Item>
                    <Descriptions.Item label="Клиент">{originalBill.customerName || "Няма данни"}</Descriptions.Item>
                    <Descriptions.Item label="Обща сума">{originalBill.totalAmount.toFixed(2)} лв.</Descriptions.Item>
                    <Descriptions.Item label="Начин на плащане">{originalBill.paymentMode === 'cash' ? 'В брой' : originalBill.paymentMode === 'card' ? 'Карта' : originalBill.paymentMode}</Descriptions.Item>
                  </Descriptions>
                ) : (
                  <Text type="secondary">Оригиналният бон не е намерен или е изтрит.</Text>
                )}
              </Card>
            </Col>
          </Row>
          
          <Card title="Сторнирани артикули" className="mt-3">
            <Table 
              dataSource={selectedStorno.cartItems} 
              pagination={false}
              rowKey="_id"
              columns={[
                {
                  title: "Артикул",
                  dataIndex: "name"
                },
                {
                  title: "Количество",
                  dataIndex: "quantity"
                },
                {
                  title: "Цена за бр.",
                  dataIndex: "price",
                  render: (price) => `${price.toFixed(2)} лв.`
                },
                {
                  title: "Общо",
                  render: (_, record) => `${(record.quantity * record.price).toFixed(2)} лв.`
                }
              ]}
            />
          </Card>
        </Modal>
      )}
    </DefaultLayout>
  );
};

export default StornoListPage;
