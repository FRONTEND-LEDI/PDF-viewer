import React, { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
).toString();

type Props = {
  url: string;
  initialPage?: number;
};

const PdfViewer: React.FC<Props> = ({ url, initialPage }) => {
  const params = new URLSearchParams(window.location.search);
  const initialPageFromQuery = parseInt(params.get("page") || "1", 10);
  const startPage = initialPage ?? initialPageFromQuery;

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(startPage);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialScroll = useRef(true);
  const [pageHeights, setPageHeights] = useState<number[]>([]);
  const lastSentMessage = useRef<{page: number, total: number}>({page: 0, total: 0});
  const scrollTimeoutRef = useRef<number | null>(null);
  const isDocumentReady = useRef(false);

  /**
   * Función para navegar a una página específica
   * Expuesta globalmente para que React Native pueda llamarla
   */
  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= numPages) {
      scrollToPage(pageNumber);
    }
  };

  // Exponer la función globalmente
  useEffect(() => {
    (window as any).goToPage = goToPage;
    return () => {
      delete (window as any).goToPage;
    };
  }, [numPages]);

  /**
   * Función para desplazarse a una página específica
   * Calcula la posición de scroll basada en las alturas de las páginas
   */
  const scrollToPage = (pageNumber: number) => {
    if (!containerRef.current || pageHeights.length === 0) return;

    let scrollPosition = 0;
    for (let i = 0; i < pageNumber - 1; i++) {
      scrollPosition += pageHeights[i];
    }

    containerRef.current.scrollTo({
      top: scrollPosition,
      behavior: "smooth",
    });

    setCurrentPage(pageNumber);
    
    // Actualizar lastSentMessage cuando se navega programáticamente
    lastSentMessage.current = { page: pageNumber, total: numPages };
    
    // Notificar el cambio de página inmediatamente
    (window as any).ReactNativeWebView?.postMessage(
      JSON.stringify({
        type: "PAGE_CHANGE",
        page: pageNumber,
        total: numPages,
        finished: pageNumber === numPages
      })
    );

    // Enviar confirmación de navegación inicial
    if (isInitialScroll.current) {
      setTimeout(() => {
        (window as any).ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: "PAGE_CHANGE_CONFIRMED",
            page: pageNumber,
            total: numPages
          })
        );
      }, 300);
    }
  };

  /**
   * Efecto principal para renderizar el PDF
   * Carga el documento, renderiza cada página y calcula las alturas
   */
  useEffect(() => {
    const renderPdf = async () => {
      try {
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        const pdf: PDFDocumentProxy = await getDocument(url).promise;
        setNumPages(pdf.numPages);

        const heights: number[] = [];
        const canvasElements: HTMLCanvasElement[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page: PDFPageProxy = await pdf.getPage(pageNum);
          const containerWidth = containerRef.current?.clientWidth || 300;
          const scale = containerWidth / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = "block";
          canvas.style.marginBottom = "16px";

          await page.render({ canvasContext: context, viewport }).promise;

          heights.push(canvas.height + 16);
          canvasElements.push(canvas);
        }

        setPageHeights(heights);

        canvasElements.forEach((canvas) => {
          containerRef.current?.appendChild(canvas);
        });

        // Agregar un elemento marcador al final para mejorar la detección
        const endMarker = document.createElement('div');
        endMarker.id = 'pdf-end-marker';
        endMarker.style.height = '1px';
        endMarker.style.width = '1px';
        containerRef.current?.appendChild(endMarker);

        // Marcar documento como listo
        isDocumentReady.current = true;

        // Enviar información al WebView
        (window as any).ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: "LOADED",
            total: pdf.numPages,
            currentPage: startPage
          })
        );

        // Scroll inicial con timeout aumentado para asegurar renderizado completo
        if (isInitialScroll.current && startPage > 1) {
          setTimeout(() => {
            scrollToPage(startPage);
            isInitialScroll.current = false;
          }, 800);
        } else {
          isInitialScroll.current = false;
        }
      } catch (error) {
        console.error("Error rendering PDF:", error);
      }
    };

    renderPdf();
  }, [url, startPage]);

  /**
   * Manejador de evento de scroll
   * Detecta la página actual y si se llegó al final del documento
   * Usa debounce para optimizar el rendimiento
   */
  const handleScroll = () => {
    if (!containerRef.current || pageHeights.length === 0) return;
    
    // Usar debounce para el scroll para evitar múltiples llamadas
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      const scrollTop = containerRef.current?.scrollTop || 0;
      const containerHeight = containerRef.current?.clientHeight || 0;
      const scrollBottom = scrollTop + containerHeight;
      const totalHeight = pageHeights.reduce((sum, height) => sum + height, 0);

      let accumulated = 0;
      let newCurrentPage = 1;
      let isAtVeryBottom = false;
      
      // Detección especial para la última página - más sensible
      isAtVeryBottom = scrollBottom >= totalHeight - 50; // 50px de margen
      
      if (isAtVeryBottom) {
        newCurrentPage = numPages;
      } else {
        // Calcular la página actual normal
        for (let i = 0; i < pageHeights.length; i++) {
          accumulated += pageHeights[i];
          if (scrollTop < accumulated) {
            newCurrentPage = i + 1;
            break;
          }
        }
      }

      // Solo enviar si la página cambió
      if (newCurrentPage !== currentPage) {
        setCurrentPage(newCurrentPage);

        // Determinar si es la última página
        const isFinished = newCurrentPage === numPages && isAtVeryBottom;

        (window as any).ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: "PAGE_CHANGE",
            page: newCurrentPage,
            total: numPages,
            finished: isFinished
          })
        );
        
        lastSentMessage.current = { page: newCurrentPage, total: numPages };
        
        // Forzar un guardado inmediato cuando se llega a la última página
        if (isFinished) {
          // Enviar mensaje adicional para finalización
          (window as any).ReactNativeWebView?.postMessage(
            JSON.stringify({
              type: "BOOK_FINISHED",
              page: newCurrentPage,
              total: numPages
            })
          );
        }
      }
    }, 100);
  };

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        overflowY: "auto",
        height: "100vh",
        width: "100%",
        background: "#f2f2f2",
        margin: 0,
      }}
    />
  );
};

export default PdfViewer;