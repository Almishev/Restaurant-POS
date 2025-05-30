import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Layout, Menu } from "antd";
import { Link, useNavigate } from "react-router-dom";
import {FolderOpenOutlined,
  TableOutlined,
  MenuUnfoldOutlined,
  ProfileOutlined,
  MenuFoldOutlined,
  UserOutlined,
  LogoutOutlined,
  CopyOutlined,
  UnorderedListOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import "../styles/DefaultLayout.css";
import Spinner from "./Spinner";
import axios from "axios";
const { Header, Sider, Content } = Layout;

const DefaultLayout = ({ children }) => {
  const navigate = useNavigate();
  const { cartItems, loading, totalAmount } = useSelector((state) => state.rootReducer);
  const [collapsed, setCollapsed] = useState(false);

  const toggle = () => {
    setCollapsed(!collapsed);
  };
  //to get localstorage data
  useEffect(() => {
    const selectedTable = localStorage.getItem("selectedTable")
      ? JSON.parse(localStorage.getItem("selectedTable"))
      : null;
    const cartKey = selectedTable ? `cartItems_${selectedTable._id}` : "cartItems";
    localStorage.setItem(cartKey, JSON.stringify(cartItems));
    if (selectedTable) {
      axios.put("/api/tables/update-table-cart", {
        tableId: selectedTable._id,
        cartItems,
        totalAmount: typeof totalAmount !== "undefined" ? totalAmount : 0,
      });
    }
  }, [cartItems, totalAmount]);

  return (
    <Layout>
      {loading && <Spinner />}
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div className="logo">
          <h1 className="text-center text-light font-wight-bold mt-4">POS Система</h1>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={window.location.pathname}
        >
          <Menu.Item key="/" icon={<ProfileOutlined />}>
            <Link to="/order">Поръчка</Link>
          </Menu.Item>
          <Menu.Item key="/bills" icon={<CopyOutlined />}>
            <Link to="/bills">Сметки</Link>
          </Menu.Item>
          <Menu.Item key="/items" icon={<UnorderedListOutlined />}>
            <Link to="/items">Артикули</Link>
          </Menu.Item>
          <Menu.Item key="/categories" icon={<FolderOpenOutlined />}>
            <Link to="/categories">Категории</Link>
          </Menu.Item>
          <Menu.Item key="/customers" icon={<UserOutlined />}>
            <Link to="/customers">Клиенти</Link>
          </Menu.Item>
          <Menu.Item key="/tables" icon={<TableOutlined />}>
            <Link to="/tables">Маси</Link>
          </Menu.Item>
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
      <Layout className="site-layout">
        <Header className="site-layout-background" style={{ padding: 0 }}>
          {React.createElement(
            collapsed ? MenuUnfoldOutlined : MenuFoldOutlined,
            {
              className: "trigger",
              onClick: toggle,
            }
          )}
          <div
            className="cart-item d-flex jusitfy-content-space-between flex-row"
            onClick={() => navigate("/cart")}
          >
            <p>{cartItems.length}</p>
            <ShoppingCartOutlined />
          </div>
        </Header>
        <Content
          className="site-layout-background"
          style={{
            margin: "24px 16px",
            padding: 24,
            minHeight: 280,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default DefaultLayout;
