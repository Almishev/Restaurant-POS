/** Role helpers for login redirect and route access. */

const AUDITOR_PATHS = ["/bills", "/storno-list", "/storno-report", "/reports", "/reports-archive"];

export const getHomePath = (role) => {
  if (role === "bar") return "/bar";
  if (role === "kitchen") return "/kitchen";
  if (role === "auditor") return "/bills";
  return "/tables";
};

/** Station roles may only visit their own page (+ login). */
export const isStationRole = (role) => role === "bar" || role === "kitchen";

export const canAccessPath = (role, pathname) => {
  const isBar = pathname === "/bar" || pathname.startsWith("/bar/");
  const isKitchen = pathname === "/kitchen" || pathname.startsWith("/kitchen/");

  if (role === "bar") return isBar;
  if (role === "kitchen") return isKitchen;
  if (role === "auditor") {
    return AUDITOR_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  }

  // Waiters (user) — no bar/kitchen screens
  if (role === "user" && (isBar || isKitchen)) return false;

  return true;
};
