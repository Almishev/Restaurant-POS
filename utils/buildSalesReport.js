/**
 * Shared sales aggregation for X and Z reports.
 * Normalizes payment modes and builds totals / items breakdown.
 */

function isRoomCharge(mode) {
  const p = String(mode || "").trim().toLowerCase();
  return p === "room" || p === "на стая" || p === "стая";
}

function normalizePaymentMode(mode) {
  if (mode === "Брой" || mode === "cash") return "cash";
  if (mode === "Карта" || mode === "card") return "card";
  if (isRoomCharge(mode)) return "room";
  return mode || "other";
}

function buildSalesReport(bills = []) {
  const totalAmount = bills.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
  const totalBills = bills.length;

  const byPayment = bills.reduce((acc, b) => {
    const key = normalizePaymentMode(b.paymentMode);
    acc[key] = (acc[key] || 0) + (Number(b.totalAmount) || 0);
    return acc;
  }, {});

  const items = {};
  bills.forEach((bill) => {
    (bill.cartItems || []).forEach((item) => {
      const name = item.name || "Без име";
      if (!items[name]) items[name] = { quantity: 0, total: 0 };
      items[name].quantity += Number(item.quantity) || 0;
      items[name].total += (Number(item.price) || 0) * (Number(item.quantity) || 0);
    });
  });

  return { totalAmount, totalBills, byPayment, items };
}

/** Build hour-of-day breakdown (0-23). */
function buildByHour(bills = []) {
  const byHour = {};
  for (let h = 0; h < 24; h++) {
    byHour[h] = { count: 0, amount: 0 };
  }
  bills.forEach((bill) => {
    const d = new Date(bill.date || bill.createdAt);
    if (Number.isNaN(d.getTime())) return;
    const h = d.getHours();
    byHour[h].count += 1;
    byHour[h].amount += Number(bill.totalAmount) || 0;
  });
  return byHour;
}

module.exports = {
  isRoomCharge,
  normalizePaymentMode,
  buildSalesReport,
  buildByHour,
};
