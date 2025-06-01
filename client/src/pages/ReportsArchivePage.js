import React, { useState, useEffect, useRef } from 'react';
import { reportService } from '../services/reportService';
import { Table, Button, Typography, Tag, DatePicker, Input, Row, Col, Modal } from 'antd';
import { EyeOutlined, PrinterOutlined, CheckCircleOutlined, CloseCircleOutlined, SearchOutlined } from '@ant-design/icons';
import Spinner from '../components/Spinner';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import '../styles/InvoiceStyles.css';

const { Title } = Typography;
const { RangePicker } = DatePicker;

// Функция за преобразуване на BSON типове в JS типове
function normalizeReport(report) {
  // Преобразувай дати
  if (report.from && report.from.$date) {
    report.from = new Date(Number(report.from.$date.$numberLong));
  }
  if (report.to && report.to.$date) {
    report.to = new Date(Number(report.to.$date.$numberLong));
  }
  if (report.createdAt && report.createdAt.$date) {
    report.createdAt = new Date(Number(report.createdAt.$date.$numberLong));
  }
  // Преобразувай totalAmount, totalBills
  if (report.totalAmount && report.totalAmount.$numberInt) {
    report.totalAmount = Number(report.totalAmount.$numberInt);
  }
  if (report.totalBills && report.totalBills.$numberInt) {
    report.totalBills = Number(report.totalBills.$numberInt);
  }
  // Преобразувай byPayment
  if (report.byPayment) {
    Object.keys(report.byPayment).forEach(key => {
      if (report.byPayment[key] && report.byPayment[key].$numberInt) {
        report.byPayment[key] = Number(report.byPayment[key].$numberInt);
      }
    });
  }
  // Преобразувай items
  if (report.items) {
    Object.values(report.items).forEach(item => {
      if (item.quantity && item.quantity.$numberInt) {
        item.quantity = Number(item.quantity.$numberInt);
      }
      if (item.total && item.total.$numberInt) {
        item.total = Number(item.total.$numberInt);
      }
    });
  }
  // Преобразувай bills
  if (Array.isArray(report.bills)) {
    report.bills = report.bills.map(bill => {
      if (bill.totalAmount && bill.totalAmount.$numberInt) {
        bill.totalAmount = Number(bill.totalAmount.$numberInt);
      }
      if (bill.subTotal && bill.subTotal.$numberInt) {
        bill.subTotal = Number(bill.subTotal.$numberInt);
      }
      if (bill.date && bill.date.$date) {
        bill.date = new Date(Number(bill.date.$date.$numberLong));
      }
      return bill;
    });
  }
  return report;
}

const ReportsArchivePage = () => {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [dateRange, setDateRange] = useState([null, null]);
  const [search, setSearch] = useState('');
  const printRef = useRef();

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await reportService.getReports();
        // Преобразувай всички отчети
        const normalized = data.map(normalizeReport);
        setReports(normalized);
        setFilteredReports(normalized);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  // Филтриране по дата и търсене
  useEffect(() => {
    let filtered = reports;
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(r => {
        const from = dayjs(r.from);
        return from.isAfter(dateRange[0].startOf('day').subtract(1, 'ms')) && from.isBefore(dateRange[1].endOf('day').add(1, 'ms'));
      });
    }
    if (search) {
      filtered = filtered.filter(r =>
        (r.type && r.type.toLowerCase().includes(search.toLowerCase())) ||
        (r.totalAmount && r.totalAmount.toString().includes(search))
      );
    }
    setFilteredReports(filtered);
  }, [dateRange, search, reports]);

  const columns = [
    { title: 'Тип', dataIndex: 'type', key: 'type', width: 60, sorter: (a, b) => a.type.localeCompare(b.type) },
    { title: 'От', dataIndex: 'from', key: 'from', render: d => new Date(d).toLocaleString(), sorter: (a, b) => new Date(a.from) - new Date(b.from) },
    { title: 'До', dataIndex: 'to', key: 'to', render: d => new Date(d).toLocaleString(), sorter: (a, b) => new Date(a.to) - new Date(b.to) },
    { title: 'Сума', dataIndex: 'totalAmount', key: 'totalAmount', render: v => v + ' лв', sorter: (a, b) => a.totalAmount - b.totalAmount },
    { title: 'Синхронизиран', dataIndex: 'isSynchronized', key: 'isSynchronized', render: v => v ? <Tag icon={<CheckCircleOutlined />} color="success">Да</Tag> : <Tag icon={<CloseCircleOutlined />} color="error">Не</Tag>, sorter: (a, b) => (a.isSynchronized === b.isSynchronized ? 0 : a.isSynchronized ? -1 : 1) },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Button icon={<EyeOutlined />} onClick={() => { setSelectedReport(record); setModalOpen(true); }}>Виж отчет</Button>
      )
    }
  ];

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: selectedReport ? `Z-отчет-${selectedReport._id}` : 'Z-отчет',
  });

  if (loading) return <Spinner />;
  if (error) return <div>Грешка: {error}</div>;

  return (
    <div>
      <Title level={2}>Архив на отчети</Title>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="YYYY-MM-DD"
            allowClear
          />
        </Col>
        <Col>
          <Input
            placeholder="Търси по тип или сума"
            prefix={<SearchOutlined />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
          />
        </Col>
      </Row>
      <Table
        dataSource={filteredReports}
        columns={columns}
        rowKey="_id"
        pagination={{ pageSize: 10 }}
        bordered
        style={{ background: 'white' }}
      />
      <Modal
        title="Z отчет"
        visible={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={selectedReport && (
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
            Печат
          </Button>
        )}
        width={480}
        destroyOnClose
      >
        {console.log('modalOpen:', modalOpen, 'selectedReport:', selectedReport)}
        <div>Това е тестов текст в модал!</div>
        {selectedReport && (
          <div ref={printRef} style={{ padding: 12 }}>
            <div className="info" style={{ textAlign: 'center', marginBottom: 12 }}>
              <h2>POS Система</h2>
              <p>Архивиран Z отчет</p>
              <p>Период: <b>{new Date(selectedReport.from).toLocaleString()} — {new Date(selectedReport.to).toLocaleString()}</b></p>
              <p>Сума: <b>{selectedReport.totalAmount} лв</b></p>
              <p>Брой сметки: <b>{selectedReport.totalBills}</b></p>
              <p>Плащане в брой: <b>{selectedReport.byPayment?.cash || 0} лв</b></p>
              <p>Плащане с карта: <b>{selectedReport.byPayment?.card || 0} лв</b></p>
              <p>Синхронизиран: {selectedReport.isSynchronized ? <Tag color="success">Да</Tag> : <Tag color="error">Не</Tag>}</p>
            </div>
            <h4>Разбивка по артикули</h4>
            <table style={{ width: '100%', marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>Артикул</th>
                  <th>Брой</th>
                  <th>Оборот</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(selectedReport.items || {}).map(([name, v], i) => (
                  <tr key={i}>
                    <td>{name}</td>
                    <td>{v.quantity}</td>
                    <td>{v.total} лв</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4>Списък на сметките</h4>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Маса/Клиент</th>
                  <th>Сума</th>
                  <th>Плащане</th>
                </tr>
              </thead>
              <tbody>
                {(selectedReport.bills || []).map((b, i) => (
                  <tr key={i}>
                    <td>{b.date ? new Date(b.date).toLocaleString() : ''}</td>
                    <td>{b.customerName}</td>
                    <td>{b.totalAmount}</td>
                    <td>{b.paymentMode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReportsArchivePage; 