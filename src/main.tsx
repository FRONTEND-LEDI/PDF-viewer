import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppWrapper from "./AppWrapper";
import "./css/main.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/book/read/:id" element={<AppWrapper />} />
    </Routes>
  </BrowserRouter>
);
