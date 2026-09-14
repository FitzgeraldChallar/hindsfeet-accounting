import { API_BASE_URL } from "../services/api";


export function openPDF(path) {
  const token =
    localStorage.getItem("access_token");

  const url =
    `${API_BASE_URL}${path}`;

  /*
   * The backend requires authentication.
   * We cannot simply put the JWT in the URL.
   *
   * Fetch the PDF with Authorization and
   * open the resulting Blob in a new tab.
   */

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(
          "Unable to generate PDF report."
        );
      }

      return response.blob();
    })
    .then((blob) => {
      const blobUrl =
        window.URL.createObjectURL(blob);

      window.open(
        blobUrl,
        "_blank",
        "noopener,noreferrer"
      );

      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
    });
}