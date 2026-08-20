const axios = require("axios");

const PI_BASE_URL = "https://api.minepi.com/v2";

function requireApiKey() {
  if (!process.env.PI_API_KEY) throw new Error("PI_API_KEY is missing");
  return process.env.PI_API_KEY;
}

function apiHeaders() {
  return {
    Authorization: `Key ${requireApiKey()}`,
    "Content-Type": "application/json"
  };
}

async function getPiUser(accessToken) {
  const response=await axios.get(`${PI_BASE_URL}/me`,{
    headers:{Authorization:`Bearer ${accessToken}`},
    timeout:10000
  });
  if(!response.data?.uid) throw new Error("Invalid Pi user");
  return response.data;
}

async function fetchPayment(paymentId) {
  if(!paymentId) return null;
  try {
    const response=await axios.get(`${PI_BASE_URL}/payments/${paymentId}`,{
      headers:apiHeaders(),timeout:15000
    });
    return response.data || null;
  } catch(error) {
    console.error("Pi payment fetch:",error.response?.data || error.message);
    return null;
  }
}

async function approvePayment(paymentId) {
  const response=await axios.post(
    `${PI_BASE_URL}/payments/${paymentId}/approve`,
    {},
    {headers:apiHeaders(),timeout:15000}
  );
  return response.data || null;
}

async function completePayment(paymentId,txid) {
  const response=await axios.post(
    `${PI_BASE_URL}/payments/${paymentId}/complete`,
    {txid},
    {headers:apiHeaders(),timeout:15000}
  );
  return response.data || null;
}

async function cancelPayment(paymentId) {
  const response=await axios.post(
    `${PI_BASE_URL}/payments/${paymentId}/cancel`,
    {},
    {headers:apiHeaders(),timeout:15000}
  );
  return response.data || null;
}

module.exports={getPiUser,fetchPayment,approvePayment,completePayment,cancelPayment};
