import React, { useEffect, useState, useRef } from "react";
import DefaultLayout from "../components/DefaultLayout";
import { useDispatch } from "react-redux";
import { EyeOutlined } from "@ant-design/icons";
import { useReactToPrint } from "react-to-print";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Modal, Button, Table } from "antd";
import "../styles/InvoiceStyles.css";
const BillsPage = () => {
  const componentRef = useRef();
  const dispatch = useDispatch();
  const [billsData, setBillsData] = useState([]);
  const [popupModal, setPopupModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState("");
  
  // Hook for navigation
  const navigate = useNavigate();
  
  // Get user data from localStorage
  useEffect(() => {
    const userData = localStorage.getItem("auth");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUserRole(parsedUser?.role || "");
        setUserId(parsedUser?.userId || "");
        console.log("Данни за текущия потребител в BillsPage:", {
          userId: parsedUser?.userId,
          role: parsedUser?.role,
          name: parsedUser?.name
        });
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);
  
  const getAllBills = async () => {
    try {
      dispatch({
        type: "SHOW_LOADING",
      });
      
      console.log("Изпращам заявка с параметри:", { role: userRole, userId: userId });
      
      // Pass user role and ID as query parameters
      const { data } = await axios.get("/api/bills/get-bills", {
        params: { role: userRole, userId: userId }
      });
      
      console.log(`Получени ${data.length} сметки от сървъра`);
      setBillsData(data);
      dispatch({ type: "HIDE_LOADING" });
    } catch (error) {
      dispatch({ type: "HIDE_LOADING" });
      console.log("Грешка при получаване на сметки:", error);
    }
  };
  //useEffect
  useEffect(() => {
    // Only fetch bills when we have the user role and userId
    if (userRole) {
      getAllBills();
    }
    //eslint-disable-next-line
  }, [userRole, userId]);
  //print function
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  });

  //able data
  const columns = [
    { title: "ID ", dataIndex: "_id" },
    {
      title: "Име на клиент",
      dataIndex: "customerName",
    },
    { title: "Контакт", dataIndex: "customerNumber" },
    { title: "Субтотал", dataIndex: "subTotal" },
    { title: "Обща сума", dataIndex: "totalAmount" },
    {
      title: "Действие",
      dataIndex: "_id",
      render: (id, record) => {
        // Проверка за дата на създаване (сторно възможно само до 24 часа)
        // Използваме date или createdAt, което от двете е налично
        const billDate = new Date(record.createdAt || record.date);
        const currentDate = new Date();
        const timeDiff = Math.abs(currentDate - billDate) / 36e5; // hours
        const canStorno = timeDiff <= 24;
        
        console.log("Сметка:", record._id, "Дата:", billDate, "Разлика в часове:", timeDiff, "Може сторно:", canStorno);
        
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button 
              type="default"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedBill(record);
                setPopupModal(true);
              }}
            >
              Преглед
            </Button>
            {canStorno && (
              <Button 
                type="primary" 
                danger
                onClick={() => navigate(`/storno`, { state: { billId: record._id } })}
              >
                Сторниране
              </Button>
            )}
          </div>
        );
      },
    },
  ];
  console.log(selectedBill);
  return (
    <DefaultLayout>
      <div className="d-flex justify-content-between">
        <h1>Списък с сметки</h1>
      </div>
      
      {userRole !== "admin" && (
        <div style={{ marginBottom: '15px', padding: '10px', background: '#f0f8ff', border: '1px solid #1890ff', borderRadius: '4px' }}>
          Показани са само сметките, издадени от Вас.
        </div>
      )}

      <Table columns={columns} dataSource={billsData} bordered />

      {popupModal && (
        <Modal
          width={400}
          pagination={false}
          title="Сметка"
          visible={popupModal}
          onCancel={() => {
            setPopupModal(false);
          }}
          footer={false}
        >
          {/* ============ invoice modal start ==============  */}
          <div id="invoice-POS" ref={componentRef}>
            <center id="top">
              <div className="logo" />
              <div className="info">
                <h2>POS Система</h2>
                <p> Контакт : 123456 | София</p>
              </div>
              {/*End Info*/}
            </center>
            {/*End InvoiceTop*/}
            <div id="mid">
              <div className="mt-2">
                <p>
                  Име на клиент : <b>{selectedBill.customerName}</b>
                  <br />
                  Телефон : <b>{selectedBill.customerNumber}</b>
                  <br />
                  Начин на плащане: <b> {selectedBill.paymentMode === 'cash' ? 'В брой' : selectedBill.paymentMode === 'card' ? 'Карта' : selectedBill.paymentMode} </b>
                  <br />
                  Дата : <b>{selectedBill.date.toString().substring(0, 10)}</b>
                  <br />
                </p>
                <hr style={{ margin: "5px" }} />
              </div>
            </div>
            {/*End Invoice Mid*/}
            <div id="bot">
              <div id="table">
                <table>
                  <tbody>
                    <tr className="tabletitle">
                      <td className="item">
                        <h2>Артикул</h2>
                      </td>
                      <td className="Hours">
                        <h2>Количество</h2>
                      </td>
                      <td className="Rate">
                        <h2>Цена</h2>
                      </td>
                      <td className="Rate">
                        <h2>Общо</h2>
                      </td>
                    </tr>
                    {selectedBill.cartItems.map((item) => (
                      <>
                        <tr className="service">
                          <td className="tableitem">
                            <p className="itemtext">{item.name}</p>
                          </td>
                          <td className="tableitem">
                            <p className="itemtext">{item.quantity}</p>
                          </td>
                          <td className="tableitem">
                            <p className="itemtext">{item.price}</p>
                          </td>
                          <td className="tableitem">
                            <p className="itemtext">
                              {item.quantity * item.price}
                            </p>
                          </td>
                        </tr>
                      </>
                    ))}

                    <tr className="tabletitle">
                      <td />
                      <td />
                      <td className="Rate">
                        <h2>Обща сума</h2>
                       
                       
                  
                      </td>
                      <td className="payment">
                        <h2>
                          <b>{selectedBill.totalAmount} лв</b>
                        </h2>
                        
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/*End Table*/}
              <div id="legalcopy">
                <p className="legal">
                  <strong>Благодарим ви за поръчката!</strong> Моля, отбележете, че това е сума, която не
                  може да бъде върната. За контакт, моля, пишете на имейл
                  <b> help@mydomain.com</b>
                </p>
              </div>
            </div>
            {/*End InvoiceBot*/}
          </div>
          {/*End Invoice*/}
          <div className="d-flex justify-content-end mt-3">
            <Button type="primary" onClick={handlePrint}>
              Печат
            </Button>
          </div>
          {/* ============ invoice modal ends ==============  */}
        </Modal>
      )}
    </DefaultLayout>
  );
};

export default BillsPage;
