import { useEffect, useRef } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { RenewTenorPage } from "./pages/RenewTenorPage";
import { RenewSummaryPage } from "./pages/RenewSummaryPage";
import { AddSubjectFlowLayout } from "./pages/AddSubjectFlowLayout";
import { AddSubjectSelectPage } from "./pages/AddSubjectSelectPage";
import { AddSubjectSchedulePage } from "./pages/AddSubjectSchedulePage";
import { AddSubjectSummaryPage } from "./pages/AddSubjectSummaryPage";
import { StatusScreen } from "./components/StatusScreen";
import { trackVisit } from "./lib/tracking";

/** Logs a visit for the manager-requested visit-vs-payment funnel report (see
 * supabase/portal_visits_funnel_report.sql) on every route under `/:userId` -- not just the
 * landing page -- so the report can also tell how far into the flow a visitor got. Rendered once
 * at the router root (rather than in every page component) so no individual page has to remember
 * to call this. Dedupes per exact pathname within this browser session (a ref, not
 * sessionStorage) -- a hard refresh intentionally logs again, since re-visits are still visits. */
function VisitTracker() {
  const location = useLocation();
  const trackedPaths = useRef(new Set<string>());

  useEffect(() => {
    const userId = location.pathname.split("/")[1];
    if (!userId || trackedPaths.current.has(location.pathname)) return;
    trackedPaths.current.add(location.pathname);
    trackVisit(userId, location.pathname);
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <VisitTracker />
      <Routes>
        <Route path="/:userId" element={<LandingPage />} />
        <Route path="/:userId/invoices" element={<TransactionsPage />} />
        <Route path="/:userId/renew/tenor" element={<RenewTenorPage />} />
        <Route path="/:userId/renew/summary" element={<RenewSummaryPage />} />
        <Route path="/:userId/add-subject" element={<AddSubjectFlowLayout />}>
          <Route path="select" element={<AddSubjectSelectPage />} />
          <Route path="schedule" element={<AddSubjectSchedulePage />} />
          <Route path="summary" element={<AddSubjectSummaryPage />} />
        </Route>
        <Route
          path="*"
          element={<StatusScreen title="Halaman tidak ditemukan" message="Silakan cek kembali link yang Anda terima." />}
        />
      </Routes>
    </BrowserRouter>
  );
}
