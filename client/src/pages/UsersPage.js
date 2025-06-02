import React, { useState, useEffect } from "react";
import DefaultLayout from "../components/DefaultLayout";
import { useDispatch } from "react-redux";
import { Button, Form, Input, Modal, Select, Table, message } from "antd";
import axios from "axios";

const { Option } = Select;

const UsersPage = () => {
  const dispatch = useDispatch();
  const [usersData, setUsersData] = useState([]);
  const [popupModal, setPopupModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const getAllUsers = async () => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      const { data } = await axios.get("/api/users/get-users");
      setUsersData(data);
      dispatch({
        type: "HIDE_LOADING",
      });
    } catch (error) {
      dispatch({
        type: "HIDE_LOADING",
      });
      console.log(error);
    }
  };

  useEffect(() => {
    getAllUsers();
  }, []);

  const handleSubmit = async (values) => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      if (editMode) {
        await axios.put(`/api/users/update-user/${currentUser._id}`, values);
        message.success("Потребителят е обновен успешно!");
      } else {
        await axios.post("/api/users/register", values);
        message.success("Потребителят е създаден успешно!");
      }
      setPopupModal(false);
      getAllUsers();
      dispatch({
        type: "HIDE_LOADING",
      });
    } catch (error) {
      dispatch({
        type: "HIDE_LOADING",
      });
      message.error("Възникна грешка!");
      console.log(error);
    }
  };

  const handleDelete = async (record) => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      await axios.delete(`/api/users/delete-user/${record._id}`);
      message.success("Потребителят е изтрит успешно!");
      getAllUsers();
      dispatch({
        type: "HIDE_LOADING",
      });
    } catch (error) {
      dispatch({
        type: "HIDE_LOADING",
      });
      message.error("Възникна грешка!");
      console.log(error);
    }
  };

  const columns = [
    { title: "Име", dataIndex: "name" },
    { title: "Потребителско име", dataIndex: "userId" },
    { title: "Роля", dataIndex: "role" },
    {
      title: "Действия",
      dataIndex: "_id",
      render: (id, record) => (
        <div>
          <Button
            type="primary"
            style={{ marginRight: 10 }}
            onClick={() => {
              setEditMode(true);
              setCurrentUser(record);
              setPopupModal(true);
            }}
          >
            Редактиране
          </Button>
          <Button type="danger" onClick={() => handleDelete(record)}>
            Изтриване
          </Button>
        </div>
      ),
    },
  ];
  return (
    <DefaultLayout>
      <div className="d-flex justify-content-between">
        <h1>Управление на потребители</h1>
        <Button 
          type="primary" 
          onClick={() => {
            setEditMode(false);
            setCurrentUser(null);
            setPopupModal(true);
          }}
        >
          Добави потребител
        </Button>
      </div>

      <Table columns={columns} dataSource={usersData} bordered />
      
      <Modal
        title={`${editMode ? "Редактиране на" : "Добавяне на"} потребител`}
        visible={popupModal}
        onCancel={() => {
          setPopupModal(false);
          setEditMode(false);
          setCurrentUser(null);
        }}
        footer={null}
      >
        <Form 
          layout="vertical" 
          initialValues={editMode ? currentUser : {}}
          onFinish={handleSubmit}
        >
          <Form.Item name="name" label="Име" rules={[{ required: true, message: 'Моля, въведете име!' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="userId" label="Потребителско име" rules={[{ required: true, message: 'Моля, въведете потребителско име!' }]}>
            <Input />
          </Form.Item>
          {!editMode && (
            <Form.Item name="password" label="Парола" rules={[{ required: true, message: 'Моля, въведете парола!' }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="role" label="Роля" rules={[{ required: true, message: 'Моля, изберете роля!' }]} initialValue="user">
            <Select>
              <Option value="user">Потребител</Option>
              <Option value="admin">Администратор</Option>
            </Select>
          </Form.Item>
          <div className="d-flex justify-content-end">
            <Button type="primary" htmlType="submit">
              Запази
            </Button>
          </div>
        </Form>
      </Modal>
    </DefaultLayout>
  );
};

export default UsersPage;
