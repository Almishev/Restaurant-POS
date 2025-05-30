import React, { useState, useEffect } from "react";
import axios from "axios";

const SelectedTableInfo = () => {
  const [selectedTableName, setSelectedTableName] = useState("");

  useEffect(() => {
    const fetchMyTable = async () => {
      const user = localStorage.getItem("auth") ? JSON.parse(localStorage.getItem("auth")) : null;
      if (user && user.userId) {
        const tablesRes = await axios.get("/api/tables/get-tables");
        const myTable = tablesRes.data.find((t) => t.createdBy === user.userId);
        setSelectedTableName(myTable ? myTable.name : "");
      }
    };
    fetchMyTable();
  }, []);

  if (!selectedTableName) return null;

  return (
    <div style={{
      background: "#e3f0ff",
      border: "1.5px solid #1976d2",
      borderRadius: 8,
      padding: "12px 24px",
      marginBottom: 24,
      fontWeight: "bold",
      fontSize: "0.8rem",
      color: "#1976d2",
      display: "inline-block"
    }}>
      {`Избрана е маса: ${selectedTableName}`}
    </div>
  );
};

export default SelectedTableInfo; 