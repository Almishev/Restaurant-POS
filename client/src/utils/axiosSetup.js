import axios from "axios";

/** Attach auth headers from localStorage on every request */
axios.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("auth");
    if (raw) {
      const auth = JSON.parse(raw);
      if (auth?.userId) {
        config.headers["x-user-id"] = auth.userId;
      }
      if (auth?.role) {
        config.headers["x-user-role"] = auth.role;
      }
    }
  } catch (_) {
    /* ignore */
  }
  return config;
});

export default axios;
