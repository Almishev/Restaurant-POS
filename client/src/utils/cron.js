import fiscalService from "../services/fiscalService";

/** Sync status only — no auto-create of empty test Z reports */
const checkSyncStatus = async () => {
  try {
    const auth = localStorage.getItem("auth");
    if (!auth) return;
    const { role } = JSON.parse(auth);
    if (role !== "admin") return;

    const response = await fetch("/api/bills/unsynchronized-reports", {
      headers: {
        "x-user-id": JSON.parse(auth).userId || "",
        "x-user-role": role,
      },
    });
    if (!response.ok) return;
    const unsynchronizedReports = await response.json();
    if (!Array.isArray(unsynchronizedReports)) return;

    for (const report of unsynchronizedReports) {
      try {
        await fiscalService.synchronizeZReport(report._id);
      } catch (error) {
        console.error("Грешка при sync на отчет:", report._id, error);
      }
    }
  } catch (error) {
    console.error("Грешка при проверка на sync статуса:", error);
  }
};

export const initCronJobs = () => {
  // Hourly sync of already-archived unsynced Z (test stub only)
  setInterval(checkSyncStatus, 60 * 60 * 1000);
};
