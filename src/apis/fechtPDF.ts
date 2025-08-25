export const fetchPdf = async (id: string): Promise<string | null> => {
  const API_URL = import.meta.env.VITE_API_URL;

  try {
    const response = await fetch(`${API_URL}${id}`);
    if (!response.ok) throw new Error("Error al obtener la URL del PDF");

    const data = await response.json();
    if (!data.urlContentBook) throw new Error("La respuesta no contiene 'url'");

    return data.urlContentBook;
  } catch (error) {
    console.error("Error en fetchPdf:", error);
    return null;
  }
};
