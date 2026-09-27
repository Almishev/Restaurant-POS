import React, { useEffect } from "react";
import { Form, Input, Button, message } from "antd";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDispatch } from "react-redux";
import { getHomePath } from "../utils/authRoles";

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const redirectByRole = (auth) => {
    const role = auth?.role || "user";
    navigate(getHomePath(role), { replace: true });
  };

  const handleSubmit = async (value) => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      const res = await axios.post("/api/users/login", value);
      dispatch({ type: "HIDE_LOADING" });
      message.success("Успешно влизане");
      localStorage.setItem("auth", JSON.stringify(res.data));
      localStorage.removeItem("selectedTable");
      redirectByRole(res.data);
    } catch (error) {
      dispatch({ type: "HIDE_LOADING" });
      message.error("Възникна грешка");
      console.log(error);
    }
  };

  const handleExit = () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("selectedTable");
    window.close();
    setTimeout(() => {
      message.info("Затвори приложението с Alt+F4 или от менюто на устройството.");
    }, 300);
  };

  useEffect(() => {
    const raw = localStorage.getItem("auth");
    if (raw) {
      try {
        redirectByRole(JSON.parse(raw));
      } catch {
        localStorage.removeItem("auth");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return (
    <div className="register">
      <div className="regsiter-form">
        <h1>POS Система</h1>
        <h3>Вход</h3>
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="userId" label="Потребителско име">
            <Input size="large" />
          </Form.Item>
          <Form.Item name="password" label="Парола">
            <Input.Password size="large" />
          </Form.Item>

          <div className="login-actions">
            <Button danger size="large" onClick={handleExit}>
              Изход
            </Button>
            <Button type="primary" htmlType="submit" size="large">
              Вход
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
};

export default Login;
