import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Layout, Menu, message } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import MobileBottomNav from "./MobileBottomNav";
import {FolderOpenOutlined,
  FileSearchOutlined,
  RedoOutlined,
  RestOutlined,
  TableOutlined,
  HddOutlined,
  MenuUnfoldOutlined,
  ProfileOutlined,
  BookOutlined,
  MenuFoldOutlined,
  UserOutlined,
  LogoutOutlined,
  CopyOutlined,
  UnorderedListOutlined,
  RollbackOutlined,
  FileDoneOutlined

} from "@ant-design/icons";
import "../styles/DefaultLayout.css";
import Spinner from "./Spinner";
import { isStationRole } from "../utils/authRoles";
const { Header, Sider, Content } = Layout;

const DefaultLayout = ({ children }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { cartItems, loading } = useSelector((state) => state.rootReducer);
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState("");

  const toggle = () => {
    setCollapsed(!collapsed);
  };
  useEffect(() => {
    const userData = localStorage.getItem("auth");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUserRole(parsedUser?.role || "");
      } catch (error) {
        console.error("Error parsing user data:", error);
        setUserRole("");
      }
    }
  }, []);
  // Persist Redux cart to localStorage only.
  // Do NOT PUT to /update-table-cart here — Homepage owns the table cart in MongoDB.
  useEffect(() => {
    const selectedTable = localStorage.getItem("selectedTable")
      ? JSON.parse(localStorage.getItem("selectedTable"))
      : null;
    const cartKey = selectedTable ? `cartItems_${selectedTable._id}` : "cartItems";
    localStorage.setItem(cartKey, JSON.stringify(cartItems));
  }, [cartItems]);

  const stationOnly = isStationRole(userRole);
  const showBottomNav = isMobile && !stationOnly;

  return (
    <Layout>
      {loading && <Spinner />}
      <Sider trigger={null} collapsible collapsed={collapsed} 
        breakpoint="md"
        collapsedWidth="0"
        onBreakpoint={broken => setCollapsed(broken)}
      >
        <div className="logo">
          <h1 className="text-center text-light font-wight-bold mt-4">POS Система</h1>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={window.location.pathname}
        >
          {!stationOnly && (
            <Menu.Item key="/" icon={<ProfileOutlined />}>
              <span
                onClick={() => {
                  const selectedTable = localStorage.getItem("selectedTable");
                  if (!selectedTable) {
                    message.error("Няма избрана маса!");
                    navigate("/tables");
                  } else {
                    navigate("/order/" + JSON.parse(selectedTable)._id);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                Поръчка
              </span>
            </Menu.Item>
          )}
          {!stationOnly && (
            <Menu.Item key="/bills" icon={<CopyOutlined />}>
              <Link to="/bills">Сметки</Link>
            </Menu.Item>
          )}
          {userRole === "admin" && (
            <Menu.Item key="/items" icon={<UnorderedListOutlined />}>
              <Link to="/items">Артикули</Link>
            </Menu.Item>
          )}
          {userRole === "admin" && (
            <Menu.Item key="/categories" icon={<FolderOpenOutlined />}>
              <Link to="/categories">Категории</Link>
            </Menu.Item>
          )}
          {!stationOnly && (
            <Menu.Item key="/tables" icon={<TableOutlined />}>
              <Link to="/tables">Маси</Link>
            </Menu.Item>
          )}
          {(userRole === "kitchen" || userRole === "admin") && (
            <Menu.Item key="/kitchen" icon={<RedoOutlined />}>
              <Link to="/kitchen">Кухня</Link>
            </Menu.Item>
          )}
          {(userRole === "bar" || userRole === "admin") && (
            <Menu.Item key="/bar" icon={<RestOutlined />}>
              <Link to="/bar">Бар</Link>
            </Menu.Item>
          )}
          {userRole === "admin" && (
            <Menu.Item key="/dashboard" icon={<CopyOutlined />}>
              <Link to="/dashboard">Dashboard</Link>
            </Menu.Item>
          )}
          {!stationOnly && (
            <Menu.Item key="/reports" icon={<CopyOutlined />}>
              <Link to="/reports">Отчети</Link>
            </Menu.Item>
          )}
          {userRole === "admin" && (
            <Menu.Item key="/storno-list" icon={<FileDoneOutlined />}>
              <Link to="/storno-list">Сторно Операции</Link>
            </Menu.Item>
          )}
          {userRole === "admin" && (
            <Menu.Item key="/storno-report" icon={<FileSearchOutlined />}>
              <Link to="/storno-report">Отчет Сторно</Link>
            </Menu.Item>
          )}
          {userRole === "admin" && (
            <Menu.Item key="/inventory-report" icon={<HddOutlined />}>
              <Link to="/inventory-report">Складов отчет</Link>
            </Menu.Item>
          )}
          <Menu.Item
            key="/logout"
            icon={<LogoutOutlined />}
            onClick={() => {
              localStorage.removeItem("auth");
              navigate("/login");
            }}
          >
            Изход
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout className={`site-layout${showBottomNav ? " has-mobile-nav" : ""}`}>
        <Header className="site-layout-background" style={{ padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {React.createElement(
              collapsed ? MenuUnfoldOutlined : MenuFoldOutlined,
              {
                className: "trigger",
                onClick: toggle,
              }
            )}
          </div>
          
          {userRole === "admin" && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Menu theme="light" mode="horizontal" style={{ display: 'flex', borderBottom: 'none', background: 'transparent' }}>
                <Menu.Item key="/reports-archive" icon={<FileSearchOutlined />} style={{ margin: '0 8px' }}>
                  <Link to="/reports-archive" style={{ color: '#1890ff' }}>Архивирани отчети</Link>
                </Menu.Item>
                <Menu.Item key="/inventory" icon={<HddOutlined />} style={{ margin: '0 8px' }}>
                  <Link to="/inventory" style={{ color: '#1890ff' }}>Склад</Link>
                </Menu.Item>
                <Menu.Item key="/recipe" icon={<BookOutlined />} style={{ margin: '0 8px' }}>
                  <Link to="/recipe" style={{ color: '#1890ff' }}>Рецепти</Link>
                </Menu.Item>
                <Menu.Item key="/users" icon={<UserOutlined />} style={{ margin: '0 8px' }}>
                  <Link to="/users" style={{ color: '#1890ff' }}>Потребители</Link>
                </Menu.Item>
              </Menu>
            </div>
          )}
          
          <div style={{ marginRight: '20px', color: '#1890ff', fontWeight: 'bold' }}>
            {(() => {
              const userData = localStorage.getItem("auth");
              if (userData) {
                try {
                  const parsedUser = JSON.parse(userData);
                  return `Здравей, ${parsedUser.name || "Потребител"}`;
                } catch (error) {
                  return "Здравей, Потребител";
                }
              }
              return "Здравей, Потребител";
            })()}
          </div>
        </Header>
        <Content
          className="site-layout-background"
          style={{
            margin: "16px",
            padding: 16,
            minHeight: 280,
            overflow: "auto",
          }}
        >
          {children}
        </Content>
        {showBottomNav && <MobileBottomNav />}
      </Layout>
    </Layout>
  );
};

export default DefaultLayout;
