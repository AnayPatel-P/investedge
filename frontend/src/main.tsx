import "./styles/global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Footer, Masthead } from "./components/Masthead";
import { Home } from "./pages/Home";
import { Portfolios } from "./pages/Portfolios";
import { Stock } from "./pages/Stock";
import { PrefsProvider } from "./state/prefs";

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0); // newer browsers return a Promise here; never return it as a cleanup
  }, [pathname]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrefsProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}>
          <ScrollToTop />
          <a className="visually-hidden" href="#main">
            Skip to content
          </a>
          <Masthead />
          <main id="main" className="page">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/stock/:symbol" element={<Stock />} />
              <Route path="/portfolios" element={<Portfolios />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </main>
          <Footer />
        </BrowserRouter>
      </PrefsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
