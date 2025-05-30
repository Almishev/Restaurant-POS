import { createStore, combineReducers, applyMiddleware } from "redux";

import thunk from "redux-thunk";

import { composeWithDevTools } from "redux-devtools-extension";
import { rootReducer } from "./rootReducer";

const finalReducer = combineReducers({
  rootReducer,
});

// Зареждаме количката и сумата по избрана маса
const selectedTable = localStorage.getItem("selectedTable")
  ? JSON.parse(localStorage.getItem("selectedTable"))
  : null;
const intialState = {
  rootReducer: {
    cartItems: selectedTable && selectedTable.cartItems ? selectedTable.cartItems : [],
    totalAmount: selectedTable && selectedTable.totalAmount ? selectedTable.totalAmount : 0,
  },
};
const middleware = [thunk];

const store = createStore(
  finalReducer,
  intialState,
  composeWithDevTools(applyMiddleware(...middleware))
);

export default store;
