import React, { useState, useEffect } from "react";
import DefaultLayout from "./../components/DefaultLayout";
import axios from "axios";
import { Row, Col, message } from "antd";
import { useDispatch } from "react-redux";
import ItemList from "../components/ItemList";
import { useNavigate } from "react-router-dom";
import SelectedTableInfo from "../components/SelectedTableInfo";

const Homepage = () => {
  const [itemsData, setItemsData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selecedCategory, setSelecedCategory] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Проверка за избрана маса
  useEffect(() => {
    const selectedTable = localStorage.getItem("selectedTable");
    if (!selectedTable) {
      navigate("/tables");
    }
  }, [navigate]);


 

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const res = await axios.get("/api/categories/get-categories");
      setCategories(res.data);
      if (res.data.length > 0) {
        setSelecedCategory(res.data[0].name);
      }
    } catch (error) {
      message.error("Грешка при зареждане на категориите!");
    }
  };

  // Fetch items
  const fetchItems = async () => {
    try {
      dispatch({ type: "SHOW_LOADING" });
      const { data } = await axios.get("/api/items/get-item");
      setItemsData(data);
      dispatch({ type: "HIDE_LOADING" });
    } catch (error) {
      dispatch({ type: "HIDE_LOADING" });
      message.error("Грешка при зареждане на продуктите!");
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchItems();
    // eslint-disable-next-line
  }, []);

  return (
    <DefaultLayout>
      <SelectedTableInfo />
      
      <Row gutter={24}>
        {/* Категории в ляво */}
        <Col xs={24} md={8} lg={6}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            {categories.map((category) => (
              <div
                key={category._id}
                className={`d-flex category ${
                  selecedCategory === category.name && "category-active"
                }`}
                style={{ width: "100%", marginBottom: 16, justifyContent: "flex-start" }}
                onClick={() => setSelecedCategory(category.name)}
              >
                <h4>{category.name}</h4>
              </div>
            ))}
          </div>
        </Col>
        {/* Продукти в дясно */}
        <Col xs={24} md={16} lg={18}>
          <Row>
            {itemsData
              .filter((i) => i.category === selecedCategory)
              .map((item) => (
                <Col xs={24} lg={12} md={24} sm={24} key={item._id}>
                  <ItemList item={item} />
                </Col>
              ))}
          </Row>
        </Col>
      </Row>
    </DefaultLayout>
  );
};

export default Homepage;
