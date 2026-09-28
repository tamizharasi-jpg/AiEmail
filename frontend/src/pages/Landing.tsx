import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  return <div className="landing-page grid-bg" data-testid="landing-page">
    <div className="landing-orbit orbit-one" /><div className="landing-orbit orbit-two" />
    <motion.div className="landing-core" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
      <div className="landing-logo"><Sparkles size={18} /><span>MAILMIND <b>AI</b></span></div>
      <h1>Mail intelligence,<br /><em>made legible.</em></h1>
      <button className="start-button" onClick={() => navigate("/dashboard")} data-testid="landing-start-button">Start exploring <ArrowRight size={16} /></button>
    </motion.div>
    <div className="landing-footer">AI EMAIL INTELLIGENCE <span>•</span> NLP / ML / EXPLAINABILITY</div>
  </div>;
}