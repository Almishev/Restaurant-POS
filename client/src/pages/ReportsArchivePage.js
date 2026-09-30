import React, { useState, useEffect, useRef } from "react";
import DefaultLayout from "../components/DefaultLayout";
import { reportService } from "../services/reportService";
import {
  Table,
  Button,
  Typography,
  Tag,
  DatePicker,
  Input,
  Row,
  Col,
  Modal,
  message,
} from "antd";
import {
  EyeOutlined,
  PrinterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import Spinner from "../components/Spinner";
import { useReactToPrint } from "react-to-print";
import dayjs from "dayjs";
import "../styles/InvoiceStyles.css";
import { formatPrice } from "../utils/formatPrice";

const { Title } = Typography;
const { RangePicker } = DatePicker;

function normalizeReport(report) {
  if (report.from && report.from.$date) {
    report.from = new Date(Number(report.from.$date.$numberLong));
  }
  if (report.to && report.to.$date) {
    report.to = new Date(Number(report.to.$date.$numberLong));
  }
  if (report.totalAmount && report.totalAmount.$numberInt) {
    report.totalAmount = Number(report.totalAmount.$numberInt);
  }
  if (report.totalBills && report.totalBills.$numberInt) {
    report.totalBills = Number(report.totalBills.$numberInt);
  }
  if (report.byPayment) {
    Object.keys(report.byPayment).forEach((key) => {
      if (report.byPayment[key] && report.byPayment[key].$numberInt) {
        report.byPayment[key] = Number(report.byPayment[key].$numberInt);
      }
    });
  }
  if (report.items) {
    Object.values(report.items).forEach((item) => {
      if (item.quantity && item.quantity.$numberInt) {
        item.quantity = Number(item.quantity.$numberInt);
      }
      if (item.total && item.total.$numberInt) {
        item.total = Number(item.total.$numberInt);
      }
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
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const printRef = useRef();

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await reportService.getReports();
        const normalized = data.map(normalizeReport);
        setReports(normalized);
        setFilteredReports(normalized);
        setLoading(false);
      } catch (err) {
        setError(err.message || "Грешка при зареждане");
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  useEffect(() => {
    let filtered = reports;
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter((r) => {
        const from = dayjs(r.from);
        return (
          from.isAfter(dateRange[0].startOf("day").subtract(1, "ms")) &&
          from.isBefore(dateRange[1].endOf("day").add(1, "ms"))
        );
      });
    }
    if (search) {
      filtered = filtered.filter(
        (r) =>
          (r.type && r.type.toLowerCase().includes(search.toLowerCase())) ||
          (r.totalAmount && r.totalAmount.toString().includes(search))
      );
    }
    setFilteredReports(filtered);
  }, [dateRange, search, reports]);

  const handleSync = async () => {
    if (!selectedReport?._id) return;
    setSyncing(true);
    try {
      await reportService.synchronizeReport(selectedReport._id);
      message.success("Тестов sync: отчетът е маркиран като синхронизиран");
      const data = await reportService.getReports();
      const normalized = data.map(normalizeReport);
      setReports(normalized);
      const updated = normalized.find((r) => r._id === selectedReport._id);
      if (updated) setSelectedReport(updated);
    } catch (e) {
      message.error(e.response?.data?.message || "Грешка при sync");
    } finally {
      setSyncing(false);
    }
  };

  const columns = [
    { title: "Тип", dataIndex: "type", key: "type", width: 60 },
    {
      title: "От",
      dataIndex: "from",
      key: "from",
      render: (d) => new Date(d).toLocaleString(),
    },
    {
      title: "До",
      dataIndex: "to",
      key: "to",
      render: (d) => new Date(d).toLocaleString(),
    },
    {
      title: "Сума",
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (v) => formatPrice(v),
    },
    {
      title: "Синхронизиран",
      dataIndex: "isSynchronized",
      key: "isSynchronized",
      render: (v) =>
        v ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Да
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            Не (тестов)
          </Tag>
        ),
    },
    {
      title: "Действия",
      key: "actions",
      render: (_, record) => (
        <Button
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedReport(record);
            setModalOpen(true);
          }}
        >
          Виж отчет
        </Button>
      ),
    },
  ];

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: selectedReport ? `Z-отчет-${selectedReport._id}` : "Z-отчет",
  });

  if (loading) return <Spinner />;
  if (error) {
    return (
      <DefaultLayout>
        <div>Грешка: {error}</div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <Title level={2}>Архив на Z отчети</Title>
      <p style={{ color: "#888", marginBottom: 16 }}>
        Вътрешни архивирани отчети. Фискалният sync е в тестов режим.
      </p>
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
            onChange={(e) => setSearch(e.target.value)}
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
        style={{ background: "white" }}
      />
      <Modal
        title="Z отчет"
        visible={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={
          selectedReport && (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {!selectedReport.isSynchronized && (
                <Button
                  icon={<SyncOutlined />}
                  loading={syncing}
                  onClick={handleSync}
                >
                  Тестов sync
                </Button>
              )}
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={handlePrint}
              >
                Печат
              </Button>
            </div>
          )
        }
        width={520}
        destroyOnClose
      >
        {selectedReport && (
          <div ref={printRef} style={{ padding: 12 }}>
            <div className="info" style={{ textAlign: "center", marginBottom: 12 }}>
              <h2>POS Система</h2>
              <p>Архивиран Z отчет (вътрешен)</p>
              <p>
                Период:{" "}
                <b>
                  {new Date(selectedReport.from).toLocaleString()} —{" "}
                  {new Date(selectedReport.to).toLocaleString()}
                </b>
              </p>
              <p>
                Сума: <b>{formatPrice(selectedReport.totalAmount)}</b>
              </p>
              <p>
                Брой сметки: <b>{selectedReport.totalBills}</b>
              </p>
              <p>
                Плащане в брой: <b>{formatPrice(selectedReport.byPayment?.cash || 0)}</b>
              </p>
              <p>
                Плащане с карта: <b>{formatPrice(selectedReport.byPayment?.card || 0)}</b>
              </p>
              <p>
                На стая (извън Z): <b>{formatPrice(selectedReport.roomAmount || 0)}</b>
              </p>
              <p>
                Синхронизиран:{" "}
                {selectedReport.isSynchronized ? (
                  <Tag color="success">Да</Tag>
                ) : (
                  <Tag color="error">Не</Tag>
                )}
              </p>
            </div>
            <h4>Разбивка по артикули</h4>
            <table style={{ width: "100%", marginBottom: 16 }}>
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
                    <td>{formatPrice(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4>Списък на сметките</h4>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Маса</th>
                  <th>Сума</th>
                  <th>Плащане</th>
                </tr>
              </thead>
              <tbody>
                {(selectedReport.bills || []).map((b, i) => (
                  <tr key={i}>
                    <td>{b.date ? new Date(b.date).toLocaleString() : ""}</td>
                    <td>{b.tableName || b.customerName}</td>
                    <td>{formatPrice(b.totalAmount)}</td>
                    <td>{b.paymentMode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </DefaultLayout>
  );
};

export default ReportsArchivePage;
