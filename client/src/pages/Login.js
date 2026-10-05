import React, { useEffect, useState } from "react";
import { Button, message } from "antd";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDispatch } from "react-redux";
import { getHomePath } from "../utils/authRoles";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const redirectByRole = (auth) => {
    const role = auth?.role || "user";
    navigate(getHomePath(role), { replace: true });
  };

  const handleSubmit = async (password = code) => {
    if (!password || busy) return;
    try {
      setBusy(true);
      dispatch({ type: "SHOW_LOADING" });
      const res = await axios.post("/api/users/login", { password });
      dispatch({ type: "HIDE_LOADING" });
      message.success("Успешно влизане");
      localStorage.setItem("auth", JSON.stringify(res.data));
      localStorage.removeItem("selectedTable");
      if (res.data?.license?.offline) {
        message.warning("Офлайн лиценз (последна успешна проверка)");
      }
      redirectByRole(res.data);
    } catch (error) {
      dispatch({ type: "HIDE_LOADING" });
      setCode("");
      const status = error?.response?.status;
      const msg =
        error?.response?.data?.message ||
        (status === 403 ? "Абонаментът не е валиден" : "Грешен код");
      message.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const press = (key) => {
    if (key === "C") {
      setCode("");
      return;
    }
    if (key === "⌫") {
      setCode((current) => current.slice(0, -1));
      return;
    }
    setCode((current) => (current.length >= 12 ? current : current + key));
  };

  const handleExit = () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("selectedTable");
    window.close();
    setTimeout(() => {
      message.info("Затвори приложението с Alt+F4 или от менюто на устройството.");
    }, 300);
  };

  useEffect(() => {
    const raw = localStorage.getItem("auth");
    if (raw) {
      try {
        redirectByRole(JSON.parse(raw));
      } catch {
        localStorage.removeItem("auth");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key >= "0" && event.key <= "9") {
        press(event.key);
      } else if (event.key === "Backspace") {
        press("⌫");
      } else if (event.key === "Enter") {
        setCode((current) => {
          handleSubmit(current);
          return current;
        });
      } else if (event.key === "Escape") {
        press("C");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  return (
    <div className="register">
      <div className="regsiter-form pin-login">
        <h1>POS Система</h1>
        <h3>Код за достъп</h3>
        <div className="pin-display" aria-label="Въведен код">
          {code ? "•".repeat(code.length - 1) + code.slice(-1) : "—"}
        </div>
        <div className="pin-pad">
          {KEYS.map((key) => (
            <button key={key} type="button" className="pin-key" onClick={() => press(key)}>
              {key}
            </button>
          ))}
        </div>
        <div className="login-actions">
          <Button danger size="large" onClick={handleExit}>
            Изход
          </Button>
          <Button type="primary" size="large" loading={busy} onClick={() => handleSubmit()}>
            Вход
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;
