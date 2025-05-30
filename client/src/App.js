import "antd/dist/antd.min.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CartPage from "./pages/CartPage";
import Homepage from "./pages/Homepage";
import ItemPage from "./pages/ItemPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import BillsPage from "./pages/BillsPage";
import CutomerPage from "./pages/CutomerPage";
import CategoriesPage from "./pages/CategoriesPage";
import TablesPage from "./pages/TablesPage";
import axios from "axios";
import { useEffect, useState } from "react";
import { message } from "antd";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/tables" />} />
          <Route
            path="/order"
            element={
              <ProtectedRoute>
                <TableProtectedRoute>
                  <Homepage />
                </TableProtectedRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <CategoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items"
            element={
              <ProtectedRoute>
                <ItemPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cart"
            element={
              <ProtectedRoute>
                <CartPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bills"
            element={
              <ProtectedRoute>
                <BillsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <CutomerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tables"
            element={
              <ProtectedRoute>
                <TablesPage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;

export function ProtectedRoute({ children }) {
  if (localStorage.getItem("auth")) {
    return children;
  } else {
    return <Navigate to="/login" />;
  }
}

function TableProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [hasTable, setHasTable] = useState(false);
  const user = localStorage.getItem("auth") ? JSON.parse(localStorage.getItem("auth")) : null;

  useEffect(() => {
    const checkTable = async () => {
      if (user && user.userId) {
        try {
          const res = await axios.get(`/api/users/get-current-table/${user.userId}`);
          if (res.data.currentTableId) {
            setHasTable(true);
          } else {
            setHasTable(false);
          }
        } catch {
          setHasTable(false);
        }
      } else {
        setHasTable(false);
      }
      setLoading(false);
    };
    checkTable();
    // eslint-disable-next-line
  }, []);

  if (loading) return null;
  if (hasTable) return children;
  message.warning("Няма избрана маса, моля първо изберете маса");
  return <Navigate to="/tables" />;
}
