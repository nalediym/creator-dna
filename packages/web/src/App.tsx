import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { HomePage } from "./pages/home";
import { PrivacyPage } from "./pages/privacy";
import { ReportPage } from "./pages/report";
import { DiagnosePage } from "./pages/diagnose";
import { TestNanoPage } from "./pages/test-nano";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/diagnose" element={<DiagnosePage />} />
        <Route path="/test-nano" element={<TestNanoPage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}
