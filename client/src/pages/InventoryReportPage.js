import React, { useEffect, useState } from "react";
import DefaultLayout from "../components/DefaultLayout";
import axios from "axios";
import { Button, Card, Col, DatePicker, Row, Table, Typography, message } from "antd";
import dayjs from "dayjs";
import { downloadCsv } from "../utils/downloadCsv";

const { RangePicker } = DatePicker;
const { Title } = Typography;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const InventoryReportPage = () => {
  const [dates, setDates] = useState([dayjs().startOf("day").subtract(7, "day"), dayjs().endOf("day")]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!dates[0] || !dates[1]) {
      message.error("Избери период");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get("/api/bills/inventory-report", {
        params: {
          from: dates[0].startOf("day").toISOString(),
          to: dates[1].endOf("day").toISOString(),
        },
      });
      setData(res.data);
    } catch (e) {
      message.error(e.response?.data?.message || "Грешка при складов отчет");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Консумация (out)"],
      ["Артикул", "Количество"],
      ...Object.entries(data.consumption || {}).map(([n, q]) => [n, round2(q)]),
      [],
      ["Връщания / вход (in)"],
      ["Артикул", "Количество"],
      ...Object.entries(data.restores || {}).map(([n, q]) => [n, round2(q)]),
    ];
    downloadCsv(`inventory-report-${dayjs().format("YYYYMMDD")}.csv`, rows);
  };

  return (
    <DefaultLayout>
      <Title level={2}>Складов отчет</Title>
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <RangePicker value={dates} onChange={(v) => setDates(v || [null, null])} />
        </Col>
        <Col>
          <Button type="primary" loading={loading} onClick={load}>
            Зареди
          </Button>
        </Col>
        <Col>
          <Button onClick={exportCsv} disabled={!data}>
            CSV
          </Button>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Консумация (out)" loading={loading}>
            <Table
              size="small"
              pagination={false}
              dataSource={Object.entries(data?.consumption || {}).map(([name, qty], i) => ({
                key: i,
                name,
                qty,
              }))}
              columns={[
                { title: "Артикул", dataIndex: "name" },
                {
                  title: "К-во",
                  dataIndex: "qty",
                  render: (v) => round2(v).toFixed(2),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Връщания / сторно (in)" loading={loading}>
            <Table
              size="small"
              pagination={false}
              dataSource={Object.entries(data?.restores || {}).map(([name, qty], i) => ({
                key: i,
                name,
                qty,
              }))}
              columns={[
                { title: "Артикул", dataIndex: "name" },
                {
                  title: "К-во",
                  dataIndex: "qty",
                  render: (v) => round2(v).toFixed(2),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
      <Card title="Движения" style={{ marginTop: 16 }} loading={loading}>
        <Table
          size="small"
          dataSource={(data?.movements || []).map((m, i) => ({ ...m, key: i }))}
          columns={[
            {
              title: "Дата",
              dataIndex: "date",
              render: (d) => new Date(d).toLocaleString(),
            },
            { title: "Име", dataIndex: "name" },
            { title: "Тип", dataIndex: "type" },
            {
              title: "К-во",
              dataIndex: "amount",
              render: (v) => round2(v).toFixed(2),
            },
            { title: "Бележка", dataIndex: "note" },
          ]}
        />
      </Card>
    </DefaultLayout>
  );
};

export default InventoryReportPage;
