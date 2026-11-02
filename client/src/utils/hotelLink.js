import { useEffect, useState } from "react";
import axios from "axios";

export function useHotelLink() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    axios
      .get("/api/bills/hotel-link")
      .then((res) => {
        if (!cancelled) setEnabled(Boolean(res.data?.enabled));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}
