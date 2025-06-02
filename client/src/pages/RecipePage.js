import React, { useEffect, useState } from "react";
import { Table, Button, Select, InputNumber, Form, Modal, message, Input } from "antd";
import axios from "axios";
import DefaultLayout from "../components/DefaultLayout";

const RecipePage = () => {
  const [items, setItems] = useState([]); // всички ястия
  const [inventory, setInventory] = useState([]); // всички суровини
  const [recipes, setRecipes] = useState([]); // всички рецепти
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecipe, setEditRecipe] = useState(null);

  useEffect(() => {
    fetchItems();
    fetchInventory();
    fetchRecipes();
  }, []);

  const fetchItems = async () => {
    const { data } = await axios.get("/api/items/get-item");
    setItems(data);
  };
  const fetchInventory = async () => {
    const { data } = await axios.get("/api/inventory");
    setInventory(data);
  };
  const fetchRecipes = async () => {
    const { data } = await axios.get("/api/recipes");
    setRecipes(data);
  };

  // Извличане на уникални категории от склада
  const categories = Array.from(new Set(inventory.map(inv => inv.category).filter(Boolean)));

  // Таблица с рецепти
  const columns = [
    { title: "Ястие", dataIndex: ["item", "name"] },
    {
      title: "Съставки",
      render: (_, record) => (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {record.ingredients.map((ing, i) => (
            <li key={i}>
              {ing.inventory?.name || "?"} - {ing.quantity} {ing.unit}
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: "Действия",
      render: (_, record) => (
        <Button onClick={() => { setEditRecipe(record); setModalOpen(true); }}>Редактирай</Button>
      ),
    },
  ];

  // Форма за редакция/създаване на рецепта
  const [form] = Form.useForm();
  useEffect(() => {
    if (editRecipe) {
      form.setFieldsValue({
        item: editRecipe.item._id,
        ingredients: editRecipe.ingredients.map(ing => ({
          inventory: ing.inventory?._id || ing.inventory,
          quantity: ing.quantity,
          unit: ing.unit || "g"
        }))
      });
    } else {
      form.resetFields();
    }
  }, [editRecipe, form]);

  const handleSave = async (values) => {
    try {
      if (editRecipe) {
        await axios.put(`/api/recipes/${editRecipe._id}`, { ingredients: values.ingredients });
        message.success("Рецептата е обновена!");
      } else {
        await axios.post(`/api/recipes`, values);
        message.success("Рецептата е създадена!");
      }
      setModalOpen(false);
      setEditRecipe(null);
      fetchRecipes();
    } catch (error) {
      message.error("Грешка при запис на рецепта!");
    }
  };

  return (
    <DefaultLayout>
      <h1>Рецепти</h1>
      <Button type="primary" onClick={() => setModalOpen(true)} style={{ marginBottom: 16 }}>
        Нова рецепта
      </Button>
      <Table columns={columns} dataSource={recipes} rowKey="_id" bordered />
      <Modal
        title={editRecipe ? "Редакция на рецепта" : "Нова рецепта"}
        visible={modalOpen}
        onCancel={() => { setModalOpen(false); setEditRecipe(null); }}
        footer={false}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="item" label="Ястие" rules={[{ required: true, message: "Избери ястие!" }]}
            initialValue={editRecipe ? editRecipe.item._id : undefined}
          >
            <Select disabled={!!editRecipe} showSearch optionFilterProp="children">
              {items.map(item => (
                <Select.Option key={item._id} value={item._id}>{item.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.List name="ingredients">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => {
                  const selectedCategory = form.getFieldValue(["ingredients", name, "category"]);
                  const filteredInventory = inventory.filter(inv => inv.category === selectedCategory);
                  // Автоматично попълване на единица при избор на суровина
                  const handleInventoryChange = (value) => {
                    const inv = inventory.find(i => i._id === value);
                    if (inv && inv.unit) {
                      form.setFields([{
                        name: ["ingredients", name, "unit"],
                        value: inv.unit
                      }]);
                    }
                  };
                  return (
                    <div key={key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      {/* Категория */}
                      <Form.Item
                        {...restField}
                        name={[name, "category"]}
                        rules={[{ required: true, message: "Избери категория!" }]}
                        style={{ flex: 2 }}
                      >
                        <Select placeholder="Категория">
                          {categories.map(cat => (
                            <Select.Option key={cat} value={cat}>{cat}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      {/* Суровина */}
                      <Form.Item
                        {...restField}
                        name={[name, "inventory"]}
                        rules={[{ required: true, message: "Избери суровина!" }]}
                        style={{ flex: 2 }}
                      >
                        <Select
                          placeholder="Суровина"
                          showSearch
                          optionFilterProp="children"
                          filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}
                          getPopupContainer={trigger => trigger.parentNode}
                          disabled={!selectedCategory}
                          onChange={handleInventoryChange}
                        >
                          {filteredInventory.map(inv => (
                            <Select.Option key={inv._id} value={inv._id}>
                              {inv.name}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, "quantity"]}
                        rules={[{ required: true, message: "Количество!" }]}
                        style={{ flex: 1 }}
                      >
                        <InputNumber min={0.1} step={0.01} placeholder="Количество" style={{ width: "100%" }} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, "unit"]}
                        style={{ flex: 1 }}
                        rules={[{ required: true, message: "Избери единица!" }]}
                      >
                        <Select placeholder="Единица">
                          <Select.Option value="бр.">бр.</Select.Option>
                          <Select.Option value="кг.">кг.</Select.Option>
                          <Select.Option value="л.">л.</Select.Option>
                        </Select>
                      </Form.Item>
                      <Button danger onClick={() => remove(name)}>-</Button>
                    </div>
                  );
                })}
                <Button type="dashed" onClick={() => add()} block>
                  + Добави съставка
                </Button>
              </>
            )}
          </Form.List>
          <div style={{ textAlign: "right" }}>
            <Button onClick={() => { setModalOpen(false); setEditRecipe(null); }} style={{ marginRight: 8 }}>
              Отказ
            </Button>
            <Button type="primary" htmlType="submit">
              Запази
            </Button>
          </div>
        </Form>
      </Modal>
    </DefaultLayout>
  );
};

export default RecipePage; 