class HotelPmsError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function hotelConfig() {
  const base = String(process.env.HOTEL_PMS_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.HOTEL_PMS_API_KEY || "").trim();
  if (!base || !key) {
    throw new HotelPmsError("Хотелът не е свързан", 503);
  }
  return { base, key };
}

async function request(path, options = {}) {
  const { base, key } = hotelConfig();
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Integration-Key": key,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(Number(process.env.HOTEL_PMS_TIMEOUT_MS) || 15000),
    });
  } catch (error) {
    throw new HotelPmsError("Хотелът не отговаря", 503);
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { error: text };
    }
  }
  if (!response.ok) {
    throw new HotelPmsError(
      data.error || data.message || "Хотелът отказа заявката",
      response.status
    );
  }
  return data;
}

function getOpenRooms() {
  return request("/api/integration/open-rooms");
}

function postRoomCharge({ bookingId, billId, tableName, amount }) {
  return request("/api/integration/room-charges", {
    method: "POST",
    body: {
      bookingId: Number(bookingId),
      billId: String(billId),
      tableName: tableName || "",
      amount: Number(amount),
    },
  });
}

function stornoRoomCharge(billId, amount, stornoKey) {
  return request(`/api/integration/room-charges/${encodeURIComponent(billId)}/storno`, {
    method: "POST",
    body: {
      amount: Number(amount),
      stornoKey: String(stornoKey),
    },
  });
}

module.exports = {
  HotelPmsError,
  getOpenRooms,
  postRoomCharge,
  stornoRoomCharge,
};
