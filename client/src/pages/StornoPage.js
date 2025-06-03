import React, { useState, useEffect } from "react";
import DefaultLayout from "../components/DefaultLayout";
import { useDispatch } from "react-redux";
import { 
  Button, 
  Form, 
  Input, 
  Modal, 
  Select, 
  Table, 
  DatePicker, 
  message, 
  Checkbox,
  Row,
  Col,
  Card,
  Divider,
  Typography
} from "antd";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Title, Text } = Typography;

const StornoPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [billsData, setBillsData] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [stornoModalVisible, setStornoModalVisible] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  // Данни за филтриране
  const [dateRange, setDateRange] = useState([]);
  const [filterValues, setFilterValues] = useState({
    customerName: "",
    paymentMode: ""
  });
  
  // Състояние за зареждане на потребителски данни
  const [userData, setUserData] = useState(null);
  // При зареждане на компонента
  useEffect(() => {
    const userDataStr = localStorage.getItem("auth");
    if (userDataStr) {
      try {
        const parsedUserData = JSON.parse(userDataStr);
        setUserData(parsedUserData);
        getAllBills(parsedUserData);
        
        // Ако имаме ID на бон от навигацията, зареждаме го автоматично
        if (location.state?.billId) {
          setTimeout(() => {
            loadBillAndOpenStornoModal(location.state.billId, parsedUserData);
          }, 500); // Малко закъснение, за да се заредят данните първо
        }
      } catch (error) {
        console.log("Error parsing user data:", error);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);
  
  // Зареждане на конкретен бон по ID и отваряне на модалния прозорец
  const loadBillAndOpenStornoModal = async (billId, user) => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      
      const { data } = await axios.get(`/api/bills/get-bill/${billId}`);
        if (data) {
        // Проверка дали е в рамките на 24 часа
        // Използваме date или createdAt, което от двете е налично
        const billDate = new Date(data.createdAt || data.date);
        const currentDate = new Date();
        const timeDiff = Math.abs(currentDate - billDate) / 36e5; // hours
        
        console.log("Зареждане на бон:", data._id, "Дата:", billDate, "Разлика в часове:", timeDiff);
        
        if (timeDiff > 24) {
          message.error("Сторниране е възможно само в рамките на същата работна смяна (24 часа)");
        } else {
          openStornoModal(data);
        }
      } else {
        message.error("Бонът не е намерен");
      }
      
      dispatch({
        type: "HIDE_LOADING",
      });
    } catch (error) {
      dispatch({
        type: "HIDE_LOADING",
      });
      message.error("Грешка при зареждане на бон");
      console.log(error);
    }
  };

  // Зареждане на сметките
  const getAllBills = async (user) => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      
      const params = {};
      if (dateRange.length === 2) {
        params.startDate = dateRange[0].toISOString();
        params.endDate = dateRange[1].toISOString();
      } else {
        // Автоматично настройване на диапазон за последните 24 часа, ако не е избран
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1); // 24 часа назад
        
        params.startDate = startDate.toISOString();
        params.endDate = endDate.toISOString();
        
        // Обновяване на UI компонента
        setDateRange([startDate, endDate]);
      }
      
      // Филтриране по потребител, ако не е админ
      if (user) {
        if (user.role !== 'admin') {
          params.userId = user.userId;
        }
        params.role = user.role;
      }
      
      // Филтриране по име на клиент
      if (filterValues.customerName) {
        params.customerName = filterValues.customerName;
      }
      
      // Филтриране по начин на плащане
      if (filterValues.paymentMode) {
        params.paymentMode = filterValues.paymentMode;
      }

      // Вземане само на сметки от последните 24 часа (ограничение за сторниране)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      params.startDate = yesterday.toISOString();
      params.endDate = new Date().toISOString();
      
      const { data } = await axios.get("/api/bills/get-bills", { params });
      
      setBillsData(data);
      dispatch({
        type: "HIDE_LOADING",
      });
    } catch (error) {
      dispatch({
        type: "HIDE_LOADING",
      });
      message.error("Възникна грешка при зареждане на данни");
      console.log(error);
    }
  };

  // Филтриране по дата
  const handleDateFilter = (dates) => {
    setDateRange(dates || []);
    if (dates && dates.length === 2) {
      getAllBills(userData);
    }
  };
  
  // Филтриране по други параметри
  const handleFilterChange = (key, value) => {
    setFilterValues({
      ...filterValues,
      [key]: value
    });
    
    // След кратко забавяне, прилагаме филтъра
    setTimeout(() => {
      getAllBills(userData);
    }, 500);
  };

  // Отваряне на модалния прозорец за сторниране
  const openStornoModal = (bill) => {
    setSelectedBill(bill);
    setSelectedItems([...bill.cartItems.map(item => item._id)]);
    setStornoModalVisible(true);
  };
  
  // Обработка на промените в избраните артикули
  const handleItemSelection = (itemId, checked) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId]);
    } else {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    }
  };

  // Изпращане на заявка за сторниране
  const handleStornoSubmit = async (values) => {
    if (selectedItems.length === 0) {
      message.error("Моля, изберете поне един артикул за сторниране");
      return;
    }

    // Изчисляване на общата сума на избраните артикули
    const selectedItemsTotal = selectedBill.cartItems
      .filter(item => selectedItems.includes(item._id))
      .reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    // Проверка дали сумата не е 0
    if (selectedItemsTotal <= 0) {
      message.error("Общата сума на избраните артикули трябва да е по-голяма от 0");
      return;
    }

    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      
      // Филтриране на избраните артикули
      const itemsToStorno = selectedBill.cartItems.filter(item => 
        selectedItems.includes(item._id)
      );
      
      // Създаване на заявката за сторниране
      const requestData = {
        originalBillId: selectedBill._id,
        reason: values.reason,
        reasonText: values.reasonText,
        cartItems: itemsToStorno,
        userId: userData.userId,
        userName: userData.name
      };
      
      const response = await axios.post("/api/stornos/create-storno", requestData);
      
      dispatch({
        type: "HIDE_LOADING",
      });
      
      // Обработка на отговора
      if (response.status === 207) {
        // Има проблем с фискализацията
        message.warning(
          "Сторно операцията е записана, но има проблем с фискализацията: " + 
          (response.data.fiscalError || "Неизвестна грешка")
        );
      } else {
        message.success("Сторно операцията е успешна!");
      }
      
      // Затваряне на модалния прозорец и опресняване на данните
      setStornoModalVisible(false);
      setSelectedBill(null);
      setSelectedItems([]);
      getAllBills(userData);
      
    } catch (error) {
      dispatch({
        type: "HIDE_LOADING",
      });
      message.error(
        "Грешка при сторниране: " + 
        (error.response?.data?.error || error.message || "Неизвестна грешка")
      );
      console.log(error);
    }
  };

  // Колони за таблицата със сметки
  const columns = [
    {
      title: "ID",
      dataIndex: "_id",
      render: (id) => <span>{id.toString().substring(18, 24)}</span>
    },
    {
      title: "Клиент",
      dataIndex: "customerName",
      render: (name) => <span>{name || "Няма данни"}</span>
    },
    {
      title: "Телефон",
      dataIndex: "customerPhone",
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
      title: "Плащане",
      dataIndex: "paymentMode",
    },    {
      title: "Създадена",
      dataIndex: "date",
      render: (date, record) => {
        // Използваме date от модела bills, или createdAt ако е налично
        const billDate = record.createdAt || date;
        return <span>{billDate ? new Date(billDate).toLocaleString() : "Няма данни"}</span>;
      },
      sorter: (a, b) => {
        const dateA = a.createdAt || a.date;
        const dateB = b.createdAt || b.date;
        return new Date(dateA) - new Date(dateB);
      }
    },
    {
      title: "Действия",
      render: (_, record) => (
        <Button 
          type="primary" 
          onClick={() => openStornoModal(record)}
        >
          Сторниране
        </Button>
      )
    }
  ];

  return (
    <DefaultLayout>
      <div className="d-flex justify-content-between mb-3">
        <Title level={3}>Сторниране на фискални бонове</Title>
        <div>
          <Button 
            type="default" 
            onClick={() => window.open('/docs/stornoGuide.md', '_blank')}
            style={{ marginRight: '8px' }}
          >
            Помощ
          </Button>
          <Button type="primary" onClick={() => navigate("/bills")}>
            Всички сметки
          </Button>
        </div>
      </div>

      <Card className="mb-3">
        <Title level={5}>Филтри</Title>
        <Row gutter={16}>
          <Col span={8}>
            <Text strong>Дата на създаване (до 24 часа назад)</Text>
            <RangePicker 
              style={{ width: '100%', marginTop: 8 }}
              onChange={handleDateFilter}
            />
          </Col>
          <Col span={8}>
            <Text strong>Име на клиент</Text>
            <Input 
              style={{ marginTop: 8 }}
              placeholder="Въведете име" 
              onChange={(e) => handleFilterChange("customerName", e.target.value)} 
            />
          </Col>
          <Col span={8}>
            <Text strong>Начин на плащане</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Изберете начин на плащане"
              allowClear
              onChange={(value) => handleFilterChange("paymentMode", value)}
            >
              <Option value="cash">В брой</Option>
              <Option value="card">С карта</Option>
            </Select>
          </Col>
        </Row>
      </Card>
      
      <Text type="secondary" className="mb-3 d-block">
        Според изискванията на законодателството, сторниране може да се извърши само в рамките на същата работна смяна (до 24 часа след създаването на бона).
      </Text>

      <Table 
        columns={columns} 
        dataSource={billsData} 
        bordered 
        rowKey="_id"
        pagination={{ pageSize: 10 }}
      />

      {/* Модален прозорец за сторниране */}
      {selectedBill && (
        <Modal
          title="Сторниране на фискален бон"
          visible={stornoModalVisible}
          onCancel={() => {
            setStornoModalVisible(false);
            setSelectedBill(null);
            setSelectedItems([]);
          }}
          footer={null}
          width={800}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Card title="Информация за оригиналния бон" bordered={false}>                <p><strong>Бон №:</strong> {selectedBill._id.substring(18, 24)}</p>
                <p><strong>Дата:</strong> {new Date(selectedBill.createdAt || selectedBill.date).toLocaleString()}</p>
                <p><strong>Клиент:</strong> {selectedBill.customerName || "Няма данни"}</p>
                <p><strong>Обща сума:</strong> {selectedBill.totalAmount.toFixed(2)} лв.</p>
                <p><strong>Начин на плащане:</strong> {selectedBill.paymentMode === 'cash' ? 'В брой' : selectedBill.paymentMode === 'card' ? 'Карта' : selectedBill.paymentMode}</p>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Артикули за сторниране" bordered={false}>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {selectedBill.cartItems.map((item) => (
                    <div key={item._id} className="mb-2">
                      <Checkbox 
                        onChange={(e) => handleItemSelection(item._id, e.target.checked)}
                        checked={selectedItems.includes(item._id)}
                      >
                        {item.name} - {item.quantity} x {item.price.toFixed(2)} = {(item.quantity * item.price).toFixed(2)} лв.
                      </Checkbox>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>

          <Divider />

          <Form layout="vertical" onFinish={handleStornoSubmit}>
            <Form.Item 
              name="reason" 
              label="Основание за сторниране"
              rules={[{ required: true, message: 'Моля, изберете основание!' }]}
            >
              <Select>
                <Option value="operatorError">Операторска грешка</Option>
                <Option value="returnedItems">Върната стока</Option>
                <Option value="defectiveGoods">Дефектна стока</Option>
                <Option value="other">Друго</Option>
              </Select>
            </Form.Item>
            
            <Form.Item 
              name="reasonText"
              label="Допълнителна информация"
            >
              <TextArea rows={3} placeholder="Въведете подробности за причината за сторниране" />
            </Form.Item>
            
            <Row>
              <Col span={24} style={{ textAlign: 'right' }}>
                <Button 
                  style={{ marginRight: 8 }} 
                  onClick={() => {
                    setStornoModalVisible(false);
                    setSelectedBill(null);
                    setSelectedItems([]);
                  }}
                >
                  Отказ
                </Button>
                <Button type="primary" htmlType="submit" disabled={selectedItems.length === 0}>
                  Създаване на сторно
                </Button>
              </Col>
            </Row>
          </Form>
        </Modal>
      )}
    </DefaultLayout>
  );
};

export default StornoPage;
