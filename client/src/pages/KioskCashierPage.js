import React, { useEffect, useRef, useState } from "react";
import DefaultLayout from "../components/DefaultLayout";
import { Button, Input, Select, message } from "antd";
import axios from "axios";
import { formatPrice } from "../utils/formatPrice";

const KioskCashierPage = () => {
  const [kioskNumber, setKioskNumber] = useState("");
  const [kioskOrder, setKioskOrder] = useState(null);
  const [kioskMessage, setKioskMessage] = useState("");
  const [paymentMode, setPaymentMode] = useState("Брой");
  const [openRooms, setOpenRooms] = useState([]);
  const [hotelBookingId, setHotelBookingId] = useState("");
  const [paying, setPaying] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanRef = useRef(0);

  useEffect(() => {
    if (paymentMode !== "На стая") return;
    axios
      .get("/api/bills/open-rooms")
      .then((res) => setOpenRooms(Array.isArray(res.data) ? res.data : []))
      .catch(() => setOpenRooms([]));
  }, [paymentMode]);

  useEffect(() => {
    if (!scanning) return undefined;
    let cancelled = false;
    const session = scanRef.current;

    const run = async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.BarcodeDetector) {
        message.error("Този браузър не чете баркод с камера. Въведи номера или ползвай скенер.");
        setScanning(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled || session !== scanRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({
          formats: ["code_128", "ean_13", "qr_code"],
        });
        const tick = async () => {
          if (cancelled || session !== scanRef.current) return;
          if (video.readyState >= 2) {
            const codes = await detector.detect(video);
            const value = codes[0]?.rawValue;
            if (value) {
              stopScan();
              markNumber(value);
              return;
            }
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          stopScan();
          message.error("Камерата не се отвори.");
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [scanning]);

  const kioskTotal = (kioskOrder?.items || []).reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );

  const stopScan = () => {
    scanRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const markNumber = async (raw) => {
    const orderNumber = String(raw || "").replace(/\D/g, "");
    if (!orderNumber) return;
    setKioskNumber(orderNumber);
    try {
      const res = await axios.post("/api/kitchen/mark-cashier", { orderNumber });
      setKioskOrder(res.data.order);
      setKioskMessage(res.data.message);
      if (res.data.already) message.warning(res.data.message);
      else message.success(res.data.message);
    } catch (error) {
      setKioskOrder(null);
      const text = error.response?.data?.message || "Няма поръчка с този номер.";
      setKioskMessage(text);
      message.error(text);
    }
  };

  const startScan = () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.BarcodeDetector) {
      message.error("Този браузър не чете баркод с камера. Въведи номера или ползвай скенер.");
      return;
    }
    setScanning(true);
  };

  const payKioskOrder = async () => {
    if (!kioskOrder || kioskOrder.billed) return;
    if (paymentMode === "На стая" && !hotelBookingId) {
      message.error("Изберете стая");
      return;
    }
    const auth = localStorage.getItem("auth") ? JSON.parse(localStorage.getItem("auth")) : null;
    const room = openRooms.find((item) => String(item.bookingId) === String(hotelBookingId));
    const bill = {
      customerName: kioskOrder.tableName,
      tableName: kioskOrder.tableName,
      cartItems: kioskOrder.items,
      subTotal: kioskTotal,
      totalAmount: kioskTotal,
      paymentMode,
      userId: auth?.userId,
    };
    if (paymentMode === "На стая" && room) {
      bill.hotelBookingId = room.bookingId;
      bill.hotelRoomNumber = room.roomNumber;
      bill.hotelGuestName = room.guestName;
    }
    setPaying(true);
    try {
      await axios.post("/api/bills/add-bills", bill);
      await axios.post("/api/kitchen/mark-billed", { orderNumber: kioskOrder.orderNumber });
      setKioskOrder({ ...kioskOrder, billed: true });
      setKioskMessage("Сметката е генерирана.");
      message.success(
        paymentMode === "На стая" ? `Сметката е качена на стая ${room.roomNumber}` : "Сметката е генерирана"
      );
    } catch (error) {
      message.error(error.response?.data?.message || "Плащането не мина.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <DefaultLayout>
      <h1 style={{ marginTop: 0 }}>KIOSK</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          markNumber(kioskNumber);
        }}
        style={{
          padding: 16,
          border: "1px solid #d9d9d9",
          borderRadius: 8,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        <label style={{ flex: "1 1 220px" }}>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Номер от киоск</div>
          <Input
            size="large"
            autoFocus
            value={kioskNumber}
            onChange={(event) => setKioskNumber(event.target.value)}
            inputMode="numeric"
          />
        </label>
        <Button type="primary" htmlType="submit" size="large" style={{ minHeight: 44 }}>
          Маркирай
        </Button>
        <Button size="large" style={{ minHeight: 44 }} onClick={scanning ? stopScan : startScan}>
          {scanning ? "Спри камерата" : "Сканирай"}
        </Button>
        {scanning && (
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ flex: "1 1 100%", width: "100%", maxWidth: 420, background: "#111", borderRadius: 8 }}
          />
        )}
        {kioskMessage && (
          <div style={{ flex: "1 1 100%", color: kioskOrder?.atCashier ? "#1f4d3a" : "#8d2b2b" }}>
            {kioskMessage}
          </div>
        )}
        {kioskOrder && (
          <div style={{ flex: "1 1 100%" }}>
            <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
              {(kioskOrder.items || []).map((item, index) => (
                <li key={`${item.name}-${index}`}>
                  {item.name} × {item.quantity}
                  {item.price != null ? ` — ${formatPrice(item.price)}` : ""}
                </li>
              ))}
            </ul>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Общо: {formatPrice(kioskTotal)}</div>
            {!kioskOrder.billed && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                <label>
                  <div style={{ marginBottom: 6, fontWeight: 600 }}>Начин на плащане</div>
                  <Select value={paymentMode} onChange={setPaymentMode} style={{ minWidth: 220 }} size="large">
                    <Select.Option value="Брой">Брой</Select.Option>
                    <Select.Option value="Карта">Карта</Select.Option>
                    <Select.Option value="На стая">На стая</Select.Option>
                  </Select>
                </label>
                {paymentMode === "На стая" && (
                  <label>
                    <div style={{ marginBottom: 6, fontWeight: 600 }}>Стая</div>
                    <Select
                      value={hotelBookingId || undefined}
                      onChange={setHotelBookingId}
                      style={{ minWidth: 260 }}
                      size="large"
                      placeholder="Номер или име"
                      showSearch
                      optionFilterProp="label"
                    >
                      {openRooms.map((room) => (
                        <Select.Option
                          key={room.bookingId}
                          value={room.bookingId}
                          label={`${room.roomNumber} ${room.guestName}`}
                        >
                          {`Стая ${room.roomNumber} — ${room.guestName}`}
                        </Select.Option>
                      ))}
                    </Select>
                  </label>
                )}
                <Button type="primary" size="large" loading={paying} onClick={payKioskOrder} style={{ minHeight: 44 }}>
                  {paymentMode === "На стая" ? "Качи на стаята" : "Генерирай сметка"}
                </Button>
              </div>
            )}
          </div>
        )}
      </form>
    </DefaultLayout>
  );
};

export default KioskCashierPage;
