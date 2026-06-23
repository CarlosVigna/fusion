const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080";

function getToken() {
  return localStorage.getItem(
    "fusion_token"
  );
}

async function request(
  endpoint,
  options = {}
) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
  };

  const isFormData =
    options.body instanceof FormData;

  if (!isFormData) {
    headers["Content-Type"] =
      "application/json";
  }

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  if (response.status === 401) {
    localStorage.removeItem(
      "fusion_token"
    );

    window.location.href =
      "/login";

    return;
  }

  if (!response.ok) {
    let message =
      "Erro inesperado";

    try {
      const error =
        await response.json();

      message =
        error.error ||
        error.message ||
        message;
    } catch {
      //
    }

    throw new Error(message);
  }

  // Vários endpoints void (ex.: POST /observations/{id}/check) respondem
  // 200 com corpo vazio, não 204 — response.json() falha em corpo vazio
  // independente do status, então lemos como texto primeiro.
  const text = await response.text();

  return text ? JSON.parse(text) : null;
}

export const apiClient = {
  get(endpoint) {
    return request(endpoint);
  },

  post(endpoint, body, options = {}) {
    return request(endpoint, {
      method: "POST",

      body:
        body instanceof FormData
          ? body
          : JSON.stringify(body),

      ...options,
    });
  },

  put(endpoint, body) {
    return request(endpoint, {
      method: "PUT",

      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return request(endpoint, {
      method: "DELETE",
    });
  },
};