const API_BASE_URL =
  import.meta.env.VITE_API_URL;

async function upload(
  endpoint,
  file
) {
  const token =
    localStorage.getItem("token");

  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${token}`,
      },

      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(
      "Erro na importação"
    );
  }

  return response.json();
}

export function previewTracknMe(file) {
  return upload(
    "/tracknme/preview",
    file
  );
}

export function confirmTracknMe(file) {
  return upload(
    "/tracknme/confirm",
    file
  );
}