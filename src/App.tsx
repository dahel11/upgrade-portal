import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { RenewTenorPage } from "./pages/RenewTenorPage";
import { RenewSummaryPage } from "./pages/RenewSummaryPage";
import { AddSubjectFlowLayout } from "./pages/AddSubjectFlowLayout";
import { AddSubjectSelectPage } from "./pages/AddSubjectSelectPage";
import { AddSubjectSchedulePage } from "./pages/AddSubjectSchedulePage";
import { AddSubjectSummaryPage } from "./pages/AddSubjectSummaryPage";
import { StatusScreen } from "./components/StatusScreen";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:userId" element={<LandingPage />} />
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
