import React, { useEffect } from "react";
import { Form, Input, Button } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { message } from "antd";
import axios from "axios";
import { useDispatch } from "react-redux";

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (value) => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      await axios.post("/api/users/register", value);
      message.success("Регистрацията е успешна!");
      navigate("/login");
      dispatch({ type: "HIDE_LOADING" });
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
          <h3>Регистрация</h3>
          <Form layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="name" label="Име">
              <Input />
            </Form.Item>
            <Form.Item name="userId" label="Потребителксо име">
              <Input />
            </Form.Item>
            <Form.Item name="password" label="Парола">
              <Input type="password" />
            </Form.Item>

            <div className="d-flex justify-content-between">
              <p>
              Вече имате акаунт?
                <Link to="/login">Влезте тук !</Link>
              </p>
              <Button type="primary" htmlType="submit">
                Регистрация
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </>
  );
};

export default Register;
