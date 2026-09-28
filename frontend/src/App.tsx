import { Routes, Route } from "react-router-dom";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Inbox from "@/pages/Inbox";
import EmailDetail from "@/pages/EmailDetail";
import Analyze from "@/pages/Analyze";
import Analytics from "@/pages/Analytics";
import ModelInsights from "@/pages/ModelInsights";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/inbox" element={<Inbox />} />
      <Route path="/inbox/:id" element={<EmailDetail />} />
      <Route path="/analyze" element={<Analyze />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/model-insights" element={<ModelInsights />} />
      <Route path="/spam" element={<Inbox />} />
    </Routes>
  );
}
