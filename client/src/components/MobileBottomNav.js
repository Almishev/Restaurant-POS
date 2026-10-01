import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { message } from "antd";
import {
  ProfileOutlined,
  TableOutlined,
  EllipsisOutlined,
  CheckOutlined,
} from "@ant-design/icons";

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const onCount = (event) => setPendingCount(Number(event.detail) || 0);
    window.addEventListener("pos-pending-count", onCount);
    return () => window.removeEventListener("pos-pending-count", onCount);
  }, []);

  const selectedTableId = () => {
    const raw = localStorage.getItem("selectedTable");
    if (!raw) return null;
    try {
      return JSON.parse(raw)._id || null;
    } catch {
      return null;
    }
  };

  const openOrder = () => {
    const id = selectedTableId();
    if (!id) {
      message.error("Няма избрана маса!");
      navigate("/tables");
      return;
    }
    navigate("/order/" + id);
  };

  const openOperations = () => {
    if (pathname.startsWith("/order")) {
      window.dispatchEvent(new Event("pos-open-operations"));
      return;
    }
    const id = selectedTableId();
    if (!id) {
      message.error("Няма избрана маса!");
      navigate("/tables");
      return;
    }
    sessionStorage.setItem("pos-open-operations", "1");
    navigate("/order/" + id);
  };

  const openDone = () => {
    if (pathname.startsWith("/order")) {
      window.dispatchEvent(new Event("pos-open-cart"));
      return;
    }
    const id = selectedTableId();
    if (!id) {
      message.error("Няма избрана маса!");
      navigate("/tables");
      return;
    }
    sessionStorage.setItem("pos-open-cart", "1");
    navigate("/order/" + id);
  };

  const itemClass = (active) => `mobile-tabbar-item${active ? " active" : ""}`;

  return (
    <nav className="mobile-tabbar" aria-label="Долни бутони">
      <button type="button" className={itemClass(pathname.startsWith("/order"))} onClick={openOrder}>
        <span className="mobile-tabbar-icon"><ProfileOutlined /></span>
        <span>Поръчка</span>
      </button>
      <button type="button" className={itemClass(pathname.startsWith("/tables"))} onClick={() => navigate("/tables")}>
        <span className="mobile-tabbar-icon"><TableOutlined /></span>
        <span>Маси</span>
      </button>
      <button type="button" className="mobile-tabbar-item" onClick={openOperations}>
        <span className="mobile-tabbar-icon"><EllipsisOutlined /></span>
        <span>Операции</span>
      </button>
      <button type="button" className="mobile-tabbar-item" onClick={openDone}>
        <span className="mobile-tabbar-icon">
          <CheckOutlined />
          {pendingCount > 0 && <span className="mobile-tabbar-badge">{pendingCount}</span>}
        </span>
        <span>Готово</span>
      </button>
    </nav>
  );
};

export default MobileBottomNav;
