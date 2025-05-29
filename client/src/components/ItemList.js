import React from "react";
import { Button, Card } from "antd";
import { useDispatch } from "react-redux";
const ItemList = ({ item }) => {
  const dispatch = useDispatch();
  //update cart handler
  const handleAddTOCart = () => {
    dispatch({
      type: "ADD_TO_CART",
      payload: { ...item, quantity: 1 },
    });
  };
  const { Meta } = Card;
  return (
    <div>
      <Card style={{ width: 240, marginBottom: 20 }}>
        <Meta title={item.name} />
        <div className="item-button">
          <Button onClick={() => handleAddTOCart()}>Добави</Button>
        </div>
      </Card>
    </div>
  );
};

export default ItemList;
