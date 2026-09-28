import React, { useEffect, useState } from "react";
import DefaultLayout from "../components/DefaultLayout";
import axios from "axios";
import { Card, Col, Row, Statistic, Table, Typography, message } from "antd";
import { formatPrice } from "../utils/formatPrice";
import { Link } from "react-router-dom";

const { Title } = Typography;

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get("/api/bills/dashboard");
        setData(res.data);
      } catch (e) {
        message.error(e.response?.data?.message || "Грешка при dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <DefaultLayout>
      <Title level={2}>Dashboard — днес</Title>
      <p style={{ marginBottom: 16 }}>
        <Link to="/reports">Към отчети</Link>
        {" · "}
        <Link to="/inventory-report">Складов отчет</Link>
      </p>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Бруто оборот" value={data?.totalAmount || 0} precision={2} suffix="€" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Нетен оборот" value={data?.netAmount || 0} precision={2} suffix="€" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Сметки" value={data?.totalBills || 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Отворени маси" value={data?.openTables || 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Сторно бр." value={data?.stornoCount || 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Сторно сума" value={data?.stornoAmount || 0} precision={2} suffix="€" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Брой" value={data?.byPayment?.cash || 0} precision={2} suffix="€" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Карта" value={data?.byPayment?.card || 0} precision={2} suffix="€" />
          </Card>
        </Col>
      </Row>
      <Card title="Топ артикули днес" style={{ marginTop: 24 }} loading={loading}>
        <Table
          dataSource={(data?.topItems || []).map((r, i) => ({ ...r, key: i }))}
          pagination={false}
          columns={[
            { title: "Артикул", dataIndex: "name" },
            { title: "Брой", dataIndex: "quantity" },
            { title: "Оборот", dataIndex: "total", render: (v) => formatPrice(v) },
          ]}
        />
      </Card>
    </DefaultLayout>
  );
};

export default DashboardPage;
