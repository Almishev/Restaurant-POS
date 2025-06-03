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
  Statistic,
  Select,
  Divider
} from "antd";
import { PieChart } from 'react-minimal-pie-chart';
import axios from "axios";
import { useNavigate } from "react-router-dom";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Option } = Select;

const StornoReportPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [reportData, setReportData] = useState(null);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    dateRange: [],
    userId: ''
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
        
        // Зареждане на всички потребители (за админи)
        if (parsedUserData.role === 'admin') {
          loadUsers();
        }
        
        // Инициално зареждане на отчета за последните 30 дни
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        setFilters({
          ...filters,
          dateRange: [startDate, endDate]
        });
        
        generateReport(startDate, endDate, parsedUserData.role !== 'admin' ? parsedUserData.userId : '');
      } catch (error) {
        console.log("Error parsing user data:", error);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Зареждане на потребители
  const loadUsers = async () => {
    try {
      const { data } = await axios.get('/api/users/get-users');
      setUsers(data);
    } catch (error) {
      console.log("Error loading users:", error);
    }
  };

  // Генериране на отчет
  const generateReport = async (startDate, endDate, userId = '') => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      
      const params = {};
      
      if (startDate && endDate) {
        params.startDate = startDate.toISOString();
        params.endDate = endDate.toISOString();
      }
      
      if (userId) {
        params.userId = userId;
      }
      
      const { data } = await axios.get('/api/stornos/report', { params });
      
      setReportData(data);
      
      dispatch({
        type: "HIDE_LOADING",
      });
    } catch (error) {
      dispatch({
        type: "HIDE_LOADING",
      });
      message.error("Възникна грешка при генериране на отчета");
      console.log(error);
    }
  };

  // Обработка на промяна в датите
  const handleDateChange = (dates) => {
    if (dates && dates.length === 2) {
      setFilters({
        ...filters,
        dateRange: dates
      });
      
      generateReport(dates[0], dates[1], filters.userId);
    } else if (!dates) {
      setFilters({
        ...filters,
        dateRange: []
      });
      
      generateReport(null, null, filters.userId);
    }
  };

  // Обработка на промяна в потребителя
  const handleUserChange = (value) => {
    setFilters({
      ...filters,
      userId: value
    });
    
    if (filters.dateRange && filters.dateRange.length === 2) {
      generateReport(filters.dateRange[0], filters.dateRange[1], value);
    } else {
      generateReport(null, null, value);
    }
  };

  // Превод на причините за сторниране
  const translateReason = (reason) => {
    const reasons = {
      operatorError: "Операторска грешка",
      returnedItems: "Върната стока",
      defectiveGoods: "Дефектна стока",
      other: "Друго"
    };
    return reasons[reason] || reason;
  };

  // Генериране на данни за кръговата диаграма по причини
  const getPieChartDataByReason = () => {
    if (!reportData || !reportData.byReason) return [];
    
    const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
    
    return Object.entries(reportData.byReason).map(([reason, data], index) => ({
      title: translateReason(reason),
      value: data.amount,
      color: colors[index % colors.length]
    }));
  };

  // Генериране на данни за кръговата диаграма по потребители
  const getPieChartDataByUser = () => {
    if (!reportData || !reportData.byUser) return [];
    
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c'];
    
    return Object.entries(reportData.byUser).map(([userName, data], index) => ({
      title: userName,
      value: data.amount,
      color: colors[index % colors.length]
    }));
  };

  // Колони за таблицата с детайлите
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (id) => <span>{id.toString().substring(18, 24)}</span>
    },
    {
      title: "Дата",
      dataIndex: "date",
      render: (date) => <span>{new Date(date).toLocaleString()}</span>
    },
    {
      title: "Оригинален бон",
      dataIndex: "originalBillId",
      render: (id) => <span>{id.toString().substring(18, 24)}</span>
    },
    {
      title: "Причина",
      dataIndex: "reason",
      render: (reason) => <span>{translateReason(reason)}</span>
    },
    {
      title: "Сума",
      dataIndex: "amount",
      render: (amount) => <span>{amount.toFixed(2)} лв.</span>
    },
    {
      title: "Потребител",
      dataIndex: "userName"
    },    {
      title: "Действия",
      render: (_, record) => (
        <Button 
          type="primary" 
          onClick={() => navigate(`/storno-list`, { state: { stornoId: record.id } })}
        >
          Детайли
        </Button>
      )
    }
  ];

  return (
    <DefaultLayout>
      <div className="d-flex justify-content-between mb-3">
        <Title level={3}>Отчет за сторно операции</Title>
        <Button type="primary" onClick={() => navigate("/storno")}>
          Ново сторно
        </Button>
      </div>

      <Card className="mb-3">
        <Title level={5}>Филтри</Title>
        <Row gutter={16}>
          <Col span={12}>
            <Text strong>Период</Text>
            <RangePicker 
              style={{ width: '100%', marginTop: 8 }}
              value={filters.dateRange}
              onChange={handleDateChange}
            />
          </Col>
          {userData && userData.role === 'admin' && (
            <Col span={12}>
              <Text strong>Потребител</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                placeholder="Всички потребители"
                allowClear
                value={filters.userId || undefined}
                onChange={handleUserChange}
              >
                {users.map(user => (
                  <Option key={user._id} value={user._id}>{user.name}</Option>
                ))}
              </Select>
            </Col>
          )}
        </Row>
      </Card>

      {reportData ? (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Card>
                <Statistic 
                  title="Общ брой сторно операции" 
                  value={reportData.totalCount} 
                  precision={0}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic 
                  title="Обща сума на сторно операциите" 
                  value={reportData.totalAmount} 
                  precision={2}
                  suffix="лв."
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic 
                  title="Средна стойност" 
                  value={reportData.totalCount ? (reportData.totalAmount / reportData.totalCount) : 0} 
                  precision={2}
                  suffix="лв."
                />
              </Card>
            </Col>
          </Row>

          <Divider />

          <Row gutter={16} className="mt-3">
            <Col span={12}>
              <Card title="Разпределение по причини">
                {Object.keys(reportData.byReason).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '200px', height: '200px' }}>
                      <PieChart
                        data={getPieChartDataByReason()}
                        label={({ dataEntry }) => `${Math.round(dataEntry.percentage)}%`}
                        labelStyle={{ fontSize: '5px', fill: '#fff' }}
                      />
                    </div>
                    <div className="mt-3">
                      {getPieChartDataByReason().map(entry => (
                        <div key={entry.title} style={{ display: 'flex', alignItems: 'center', margin: '5px 0' }}>
                          <div style={{ width: '12px', height: '12px', backgroundColor: entry.color, marginRight: '5px' }}></div>
                          <span>{entry.title}: {entry.value.toFixed(2)} лв.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Text type="secondary">Няма данни за показване</Text>
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Разпределение по потребители">
                {Object.keys(reportData.byUser).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '200px', height: '200px' }}>
                      <PieChart
                        data={getPieChartDataByUser()}
                        label={({ dataEntry }) => `${Math.round(dataEntry.percentage)}%`}
                        labelStyle={{ fontSize: '5px', fill: '#fff' }}
                      />
                    </div>
                    <div className="mt-3">
                      {getPieChartDataByUser().map(entry => (
                        <div key={entry.title} style={{ display: 'flex', alignItems: 'center', margin: '5px 0' }}>
                          <div style={{ width: '12px', height: '12px', backgroundColor: entry.color, marginRight: '5px' }}></div>
                          <span>{entry.title}: {entry.value.toFixed(2)} лв.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Text type="secondary">Няма данни за показване</Text>
                )}
              </Card>
            </Col>
          </Row>

          <Card title="Детайли за сторно операциите" className="mt-3">
            <Table
              columns={columns}
              dataSource={reportData.stornos}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </>
      ) : (
        <Card>
          <Text type="secondary">Моля, изберете период за генериране на отчет</Text>
        </Card>
      )}
    </DefaultLayout>
  );
};

export default StornoReportPage;
