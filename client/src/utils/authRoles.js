/** Role helpers for login redirect and route access. */

export const getHomePath = (role) => {
  if (role === "bar") return "/bar";
  if (role === "kitchen") return "/kitchen";
  return "/tables";
};

/** Station roles may only visit their own page (+ login). */
export const isStationRole = (role) => role === "bar" || role === "kitchen";

export const canAccessPath = (role, pathname) => {
  const isBar = pathname === "/bar" || pathname.startsWith("/bar/");
  const isKitchen = pathname === "/kitchen" || pathname.startsWith("/kitchen/");

  if (role === "bar") return isBar;
  if (role === "kitchen") return isKitchen;

  // Waiters (user) — no bar/kitchen screens
  if (role === "user" && (isBar || isKitchen)) return false;

  return true;
};
