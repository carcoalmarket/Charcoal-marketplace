/* ==============
   API CONFIG 
================ */
const API_BASE = "https://charcoal-marketplace-2.onrender.com/api";

/* =========================
   OPTIONAL HELPERS
========================= */
function getAPI(url) {
  return `${API_BASE}${url}`;
}