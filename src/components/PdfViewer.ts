import React, { useEffect, useRef } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.js", import.meta.url).toString();

type Props = {
  url: string;
};

const PdfViewer: React.FC<Props> = ({ url }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const renderPage = async () => {
      try {
        const pdf: PDFDocumentProxy = await getDocument(url).promise;
        const page: PDFPageProxy = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,

          viewport,
        }).promise;
      } catch (error) {
        console.error("Error rendering PDF:", error);
      }
    };

    renderPage();
  }, [url]);

  return React.createElement("canvas", {
    ref: canvasRef,
    width: 0,
    height: 0,
    style: {
      display: "block",
      maxWidth: "100%",
      height: "auto",
      border: "1px solid #ccc",
    },
  });
};

export default PdfViewer;
