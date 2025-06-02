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
import KitchenPage from "./pages/KitchenPage";
import BarPage from "./pages/BarPage";
import ReportsPage from "./pages/ReportsPage";
import InventoryPage from "./pages/InventoryPage";
import RecipePage from "./pages/RecipePage";
import ReportsArchivePage from "./pages/ReportsArchivePage";
import UsersPage from "./pages/UsersPage";
import { useEffect } from "react";
import { initCronJobs } from './utils/cron';

function App() {
  useEffect(() => {
    // Инициализация на cron jobs при стартиране на приложението
    initCronJobs();
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/tables" />} />
          <Route
            path="/order"
            element={
              <ProtectedRoute>
                <Homepage />
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
          <Route
            path="/kitchen"
            element={
              <ProtectedRoute>
                <KitchenPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order/:tableId"
            element={
              <ProtectedRoute>
                <Homepage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route 
            path="/register" 
            element={
              <AdminRoute>
                <Register />
              </AdminRoute>
            } 
          />
          <Route
            path="/bar"
            element={
              <ProtectedRoute>
                <BarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports-archive"
            element={
              <ProtectedRoute>
                <ReportsArchivePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <InventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipe"
            element={
              <ProtectedRoute>
                <RecipePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
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

export function AdminRoute({ children }) {
  const auth = localStorage.getItem("auth");
  if (auth) {
    const { role } = JSON.parse(auth);
    if (role === "admin") {
      return children;
    } else {
      return <Navigate to="/" />;
    }
  } else {
    return <Navigate to="/login" />;
  }
}
