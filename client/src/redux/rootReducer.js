const intialState = {
  loading: false,
  cartItems: [],
  totalAmount: 0,
};

export const rootReducer = (state = intialState, action) => {
  switch (action.type) {
    case "SHOW_LOADING":
      return {
        ...state,
        loading: true,
      };
    case "HIDE_LOADING":
      return {
        ...state,
        loading: false,
      };
    case "ADD_TO_CART": {
      const newCart = [...state.cartItems, action.payload];
      const newTotal = newCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return {
        ...state,
        cartItems: newCart,
        totalAmount: newTotal,
      };
    }
    case "UPDATE_CART": {
      const newCart = state.cartItems.map((item) =>
        item._id === action.payload._id
          ? { ...item, quantity: action.payload.quantity }
          : item
      );
      const newTotal = newCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return {
        ...state,
        cartItems: newCart,
        totalAmount: newTotal,
      };
    }
    case "DELETE_FROM_CART": {
      const newCart = state.cartItems.filter(
        (item) => item._id !== action.payload._id
      );
      const newTotal = newCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return {
        ...state,
        cartItems: newCart,
        totalAmount: newTotal,
      };
    }
    case "UPDATE_TOTAL_AMOUNT":
      return {
        ...state,
        totalAmount: action.payload,
      };
    default:
      return state;
  }
};
