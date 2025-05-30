import React, { useEffect } from "react";
import { Form, Input, Button } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { message } from "antd";
import axios from "axios";
import { useDispatch } from "react-redux";

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
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
      navigate("/");
    } catch (error) {
      dispatch({ type: "HIDE_LOADING" });
      message.error("Възникна грешка");
      console.log(error);
    }
  };

  //currently login  user
  useEffect(() => {
    if (localStorage.getItem("auth")) {
      localStorage.getItem("auth");
      navigate("/");
    }
  }, [navigate]);
  return (
    <>
      <div className="register">
        <div className="regsiter-form">
          <h1>POS Система</h1>
          <h3>Вход</h3>
          <Form layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="userId" label="Потребителско име">
              <Input />
            </Form.Item>
            <Form.Item name="password" label="Парола">
              <Input type="password" />
            </Form.Item>

            <div className="d-flex justify-content-between">
              <p>
              Нямате акаунт?
                <Link to="/register"> Регистрирайте се тук! </Link>
              </p>
              <Button type="primary" htmlType="submit">
                Вход
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </>
  );
};

export default Login;
