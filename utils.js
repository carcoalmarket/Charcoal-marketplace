const API_BASE = "/api";

/* =========================
   SAFE API FETCH (PRODUCTION GRADE)
========================= */
async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const token =
      localStorage.getItem("adminToken") ||
      localStorage.getItem("vendorToken") ||
      localStorage.getItem("token");

    const isFormData = options.body instanceof FormData;

    const headers = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeout);

    let data;
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    return {
      success: res.ok,
      status: res.status,
      data,
      message: data.message || (res.ok ? "Success" : `HTTP Error ${res.status}`)
    };

  } catch (err) {
    clearTimeout(timeout);

    console.error("API Error:", err);

    return {
      success: false,
      status: 0,
      message:
        err.name === "AbortError"
          ? "Request timeout"
          : err.message
    };
  }
}