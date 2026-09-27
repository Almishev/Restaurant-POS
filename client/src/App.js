import "antd/dist/antd.min.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import CartPage from "./pages/CartPage";
import Homepage from "./pages/Homepage";
import ItemPage from "./pages/ItemPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import BillsPage from "./pages/BillsPage";
import CategoriesPage from "./pages/CategoriesPage";
import TablesPage from "./pages/TablesPage";
import KitchenPage from "./pages/KitchenPage";
import BarPage from "./pages/BarPage";
import ReportsPage from "./pages/ReportsPage";
import InventoryPage from "./pages/InventoryPage";
import RecipePage from "./pages/RecipePage";
import ReportsArchivePage from "./pages/ReportsArchivePage";
import UsersPage from "./pages/UsersPage";
import StornoListPage from "./pages/StornoListPage";
import StornoReportPage from "./pages/StornoReportPage";
import { useEffect } from "react";
import { initCronJobs } from "./utils/cron";
import { getHomePath, canAccessPath } from "./utils/authRoles";

function HomeRedirect() {
  const auth = localStorage.getItem("auth");
  if (!auth) return <Navigate to="/login" replace />;
  try {
    const { role } = JSON.parse(auth);
    return <Navigate to={getHomePath(role)} replace />;
  } catch {
    return <Navigate to="/login" replace />;
  }
}

function App() {
  useEffect(() => {
    initCronJobs();
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
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
          <Route
            path="/storno-list"
            element={
              <ProtectedRoute>
                <StornoListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/storno-report"
            element={
              <ProtectedRoute>
                <StornoReportPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;

function readAuth() {
  const raw = localStorage.getItem("auth");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const auth = readAuth();
  if (!auth) {
    return <Navigate to="/login" replace />;
  }
  if (!canAccessPath(auth.role, location.pathname)) {
    return <Navigate to={getHomePath(auth.role)} replace />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const auth = readAuth();
  if (!auth) {
    return <Navigate to="/login" replace />;
  }
  if (auth.role === "admin") {
    return children;
  }
  return <Navigate to={getHomePath(auth.role)} replace />;
}
