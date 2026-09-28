import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import EmailDetail from "@/pages/EmailDetail";
import Analyze from "@/pages/Analyze";
import ModelInsights from "@/pages/ModelInsights";
import Eda from "@/pages/Eda";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/inbox/:id" element={<EmailDetail />} />
      <Route path="/analyze" element={<Analyze />} />
      <Route path="/model-insights" element={<ModelInsights />} />
      <Route path="/eda" element={<Eda />} />
      <Route path="/inbox" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
