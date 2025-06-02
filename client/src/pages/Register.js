import React, { useEffect } from "react";
import { Form, Input, Button, Select } from "antd";
import { useNavigate } from "react-router-dom";
import { message } from "antd";
import axios from "axios";
import { useDispatch } from "react-redux";

const { Option } = Select;

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (value) => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      await axios.post("/api/users/register", value);
      message.success("Потребителят е създаден успешно!");
      navigate("/users");
      dispatch({ type: "HIDE_LOADING" });
    } catch (error) {
      dispatch({ type: "HIDE_LOADING" });
      message.error("Възникна грешка");
      console.log(error);
    }
  };

  // Проверка за администраторски права
  useEffect(() => {
    const auth = localStorage.getItem("auth");
    if (auth) {
      const { role } = JSON.parse(auth);
      if (role !== "admin") {
        message.error("Нямате достъп до тази страница!");
        navigate("/");
      }
    } else {
      navigate("/login");
    }
  }, [navigate]);

  return (
    <>
      <div className="register">
        <div className="regsiter-form">
          <h1>POS Система</h1>
          <h3>Създаване на потребител</h3>
          <Form layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="name" label="Име" rules={[{ required: true, message: 'Моля, въведете име!' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="userId" label="Потребителско име" rules={[{ required: true, message: 'Моля, въведете потребителско име!' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="password" label="Парола" rules={[{ required: true, message: 'Моля, въведете парола!' }]}>
              <Input type="password" />
            </Form.Item>
            <Form.Item name="role" label="Роля" rules={[{ required: true, message: 'Моля, изберете роля!' }]} initialValue="user">
              <Select>
                <Option value="user">Потребител</Option>
                <Option value="admin">Администратор</Option>
              </Select>
            </Form.Item>

            <div className="d-flex justify-content-between">
              <Button type="default" onClick={() => navigate("/users")}>
                Назад
              </Button>
              <Button type="primary" htmlType="submit">
                Създай потребител
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </>
  );
};

export default Register;
