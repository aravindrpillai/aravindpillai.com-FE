import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, FileText, Loader2, Upload as UploadIcon, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { fileApi } from "@/lib/playgroundApi";
import { errorText, usePlayground } from "../PlaygroundGate";

const MAX_FILES = 10;
const ACCEPT = ".pdf,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif";

interface PendingFile {
  file: File;
  id: string;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileAnalyserUpload = () => {
  const navigate = useNavigate();
  const session = usePlayground();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<"idle" | "uploading" | "indexing" | "done">("idle");

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = Array.from(incoming).map((file) => ({ file, id: crypto.randomUUID() }));
    setFiles((prev) => {
      const all = [...prev, ...next];
      if (all.length > MAX_FILES) toast.error(`Up to ${MAX_FILES} files at a time`);
      return all.slice(0, MAX_FILES);
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!files.length || stage !== "idle") return;
    setStage("uploading");
    setProgress(0);
    try {
      const res = await fileApi.upload(session.token, files.map((f) => f.file), (pct) => {
        setProgress(pct);
        if (pct >= 100) setStage("indexing");
      });
      setStage("done");
      setTimeout(() => navigate(`/file-analyser/chat/${res.id}`), 500);
    } catch (err) {
      setStage("idle");
      const msg = errorText(session, err, "Upload failed");
      if (msg) toast.error(msg);
    }
  };

  const busy = stage !== "idle";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute h-[400px] w-[400px] rounded-full bg-primary/[0.04] blur-[100px]" />

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center">
        <Link to="/" className="mb-8 flex items-center gap-2 self-start text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-2 text-center font-display text-3xl font-bold tracking-tight md:text-4xl">
          File <span className="text-gradient">Analyser</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8 text-center text-sm text-muted-foreground"
        >
          Upload up to {MAX_FILES} documents, then ask questions about them. Answers cite the file they came from.
          <br />
          PDF, DOCX, TXT, MD, CSV, JSON and images.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) addFiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !busy && inputRef.current?.click()}
          className={`mb-6 flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed bg-card/60 p-10 transition-colors ${
            busy ? "cursor-not-allowed border-border opacity-50" : "cursor-pointer border-border hover:border-primary"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <UploadIcon className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-medium">
            Drag & drop files here or <span className="text-primary">browse</span>
          </p>
          <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </motion.div>

        <AnimatePresence>
          {stage === "uploading" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 w-full">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Uploading files…</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </motion.div>
          )}
          {stage === "indexing" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
            >
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Reading and indexing your documents</p>
                <p className="text-xs text-muted-foreground">This can take a moment for large files or images…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {files.length > 0 && (
          <div className="mb-6 w-full space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  {stage === "done" ? (
                    <CheckCircle className="h-4 w-4 text-success" />
                  ) : stage === "indexing" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.file.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatSize(f.file.size)}</p>
                </div>
                {!busy && (
                  <button
                    onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <Button size="lg" onClick={handleUpload} disabled={!files.length || busy} className="gap-2 rounded-xl px-8 shadow-elevated">
          {stage === "uploading"
            ? `Uploading… ${progress}%`
            : stage === "indexing"
              ? "Indexing…"
              : stage === "done"
                ? "Opening chat…"
                : `Analyse ${files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : "files"}`}
        </Button>
      </div>
    </div>
  );
};

export default FileAnalyserUpload;
