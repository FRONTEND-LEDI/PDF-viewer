import { useEffect, useState } from "react";
import PdfViewer from "./PdfViewer";
import { fetchPdf } from "../apis/fechtPDF";

type Props = {
  id: string;
};

const App = ({ id }: Props) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchPdf(id).then(setPdfUrl);
  }, [id]);

  if (!pdfUrl) return <p>Cargando PDF...</p>;

  return <PdfViewer url={pdfUrl} />;
};

export default App;
