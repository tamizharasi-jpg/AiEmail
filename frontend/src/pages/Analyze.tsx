import { useMutation, useQuery } from "@tanstack/react-query";
import { LockKeyhole, Play, RotateCcw, Sparkles, UploadCloud } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "@/lib/api";
import type { AiStatusResponse, AnalyzeResponse } from "@/types/mailmind";
import AppShell from "@/components/layout/AppShell";

const GlowCursor = lazy(() => import("@/components/effects/GlowCursor"));

export default function Analyze() {
  const navigate = useNavigate();
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const mutation = useMutation({
    mutationFn: () => apiPost<AnalyzeResponse>("/analysis", { sender: sender || "Unknown sender", subject, body }),
    onSuccess: (result) => navigate(`/inbox/${result.email.id}`),
  });
  const aiStatus = useQuery({ queryKey: ["ai-status"], queryFn: () => apiGet<AiStatusResponse>("/ai-status") });
  const canAnalyze = subject.trim().length > 2 && body.trim().length > 8;

  const readFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    setBody(text.slice(0, 8000));
    if (!subject) setSubject(file.name.replace(/\.[^.]+$/, ""));
  };

  return <AppShell><Suspense fallback={null}><GlowCursor /></Suspense><div className="page-stack" data-testid="analyze-page">
    <div className="page-heading compact">
      <div><div className="eyebrow"><Sparkles size={12} /> New analysis</div><h1>Let AI understand your email.</h1><p>Paste an email or drop a file, and MailMind will explain what it is and what to do next.</p></div>
      <div className="privacy-note" data-testid="ai-status-chip"><LockKeyhole size={14} /> {aiStatus.data?.message ?? "Checking reply engine..."}</div>
    </div>
    <div className="analyze-layout single">
      <section className="paste-panel panel" data-testid="paste-email-panel">
        <div className="section-heading">
          <div><span className="eyebrow">Email</span><h2>Start with the message</h2></div>
          <button className="quiet-button" onClick={() => { setSender(""); setSubject(""); setBody(""); setFileName(""); }} data-testid="analyze-clear-button"><RotateCcw size={14} /> Clear</button>
        </div>
        <div className="field-grid">
          <label>Sender<input value={sender} onChange={(event) => setSender(event.target.value)} placeholder="e.g. rahul@company.com" data-testid="analyze-sender-input" /></label>
          <label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What is this email about?" data-testid="analyze-subject-input" /></label>
        </div>
        <label className="body-field">Email body<textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canAnalyze) mutation.mutate(); }} placeholder="Paste the complete email body here..." data-testid="analyze-body-input" /></label>
        <div
          className="upload-dropzone"
          data-testid="upload-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void readFile(file); }}
        >
          <UploadCloud size={19} />
          <strong>{fileName || "Or drop an email file here"}</strong>
          <span>.eml or .txt — the text is loaded into the body above</span>
          <input ref={fileInput} type="file" accept=".eml,.txt" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} data-testid="analyze-file-input" />
          <button className="quiet-button" onClick={() => fileInput.current?.click()} data-testid="choose-file-button">Choose file</button>
        </div>
        <div className="paste-footer">
          <span>Press Ctrl + Enter to analyze</span>
          <button className="button-primary" onClick={() => mutation.mutate()} disabled={!canAnalyze || mutation.isPending} data-testid="analyze-submit-button">{mutation.isPending ? "Analyzing..." : "Analyze email"} <Play size={14} /></button>
        </div>
        {mutation.isError && <div className="inline-error" data-testid="analyze-error">MailMind couldn’t complete the analysis. Try again.</div>}
      </section>
    </div>
  </div></AppShell>;
}
