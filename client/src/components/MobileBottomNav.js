import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Form, Input, Modal, message } from "antd";
import {
  ProfileOutlined,
  TableOutlined,
  PlusOutlined,
  EllipsisOutlined,
} from "@ant-design/icons";
import axios from "axios";

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const openOrder = () => {
    const raw = localStorage.getItem("selectedTable");
    if (!raw) {
      message.error("Няма избрана маса!");
      navigate("/tables");
      return;
    }
    try {
      navigate("/order/" + JSON.parse(raw)._id);
    } catch {
      navigate("/tables");
    }
  };

  const openOperations = () => {
    if (pathname.startsWith("/order")) {
      window.dispatchEvent(new Event("pos-open-operations"));
      return;
    }
    const raw = localStorage.getItem("selectedTable");
    if (!raw) {
      message.error("Няма избрана маса!");
      navigate("/tables");
      return;
    }
    try {
      sessionStorage.setItem("pos-open-operations", "1");
      navigate("/order/" + JSON.parse(raw)._id);
    } catch {
      navigate("/tables");
    }
  };

  const saveTable = async (values) => {
    setSaving(true);
    try {
      const auth = localStorage.getItem("auth") ? JSON.parse(localStorage.getItem("auth")) : null;
      await axios.post("/api/tables/add-table", {
        ...values,
        createdBy: auth ? auth.userId : "",
      });
      message.success("Масата е добавена успешно!");
      setAddOpen(false);
      form.resetFields();
      window.dispatchEvent(new Event("pos-tables-changed"));
      if (!pathname.startsWith("/tables")) {
        navigate("/tables");
      }
    } catch {
      message.error("Грешка при добавяне на маса!");
    } finally {
      setSaving(false);
    }
  };

  const itemClass = (active) => `mobile-tabbar-item${active ? " active" : ""}`;

  return (
    <>
      <nav className="mobile-tabbar" aria-label="Долни бутони">
        <button type="button" className={itemClass(pathname.startsWith("/order"))} onClick={openOrder}>
          <span className="mobile-tabbar-icon"><ProfileOutlined /></span>
          <span>Поръчка</span>
        </button>
        <button type="button" className={itemClass(pathname.startsWith("/tables"))} onClick={() => navigate("/tables")}>
          <span className="mobile-tabbar-icon"><TableOutlined /></span>
          <span>Маси</span>
        </button>
        <button type="button" className="mobile-tabbar-item" onClick={() => setAddOpen(true)}>
          <span className="mobile-tabbar-icon"><PlusOutlined /></span>
          <span>Добави маса</span>
        </button>
        <button type="button" className="mobile-tabbar-item" onClick={openOperations}>
          <span className="mobile-tabbar-icon"><EllipsisOutlined /></span>
          <span>Операции</span>
        </button>
      </nav>
      <Modal
        title="Добави нова маса"
        visible={addOpen}
        onCancel={() => {
          setAddOpen(false);
          form.resetFields();
        }}
        footer={null}
        width="90%"
        style={{ maxWidth: 420 }}
      >
        <Form form={form} layout="vertical" onFinish={saveTable}>
          <Form.Item name="name" label="Име на маса" rules={[{ required: true, message: "Въведи име!" }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={saving} style={{ minHeight: 48 }}>
              Запази
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default MobileBottomNav;
