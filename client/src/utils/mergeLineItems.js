/**
 * Merge line items with the same product _id into one row (sum quantities).
 * Status: "Готово" only if every line is ready; otherwise keep "Изпратено" (or first status).
 * Notes: unique non-empty notes joined with "; ".
 */
export function mergeLineItems(items = []) {
  const map = new Map();

  for (const raw of items) {
    if (!raw) continue;
    const id = String(raw._id ?? raw.itemId ?? "");
    if (!id) continue;

    const qty = Number(raw.quantity) || 0;
    const existing = map.get(id);

    if (!existing) {
      map.set(id, {
        ...raw,
        _id: raw._id ?? raw.itemId,
        quantity: qty,
      });
      continue;
    }

    const statuses = [existing.status, raw.status].filter(Boolean);
    let status = existing.status || raw.status;
    if (statuses.length) {
      status = statuses.every((s) => s === "Готово") ? "Готово" : "Изпратено";
    }

    const notes = [existing.note, raw.note]
      .map((n) => (n || "").trim())
      .filter(Boolean);
    const note = [...new Set(notes)].join("; ");

    map.set(id, {
      ...existing,
      ...raw,
      _id: existing._id,
      quantity: (Number(existing.quantity) || 0) + qty,
      status,
      note,
    });
  }

  return Array.from(map.values());
}
