import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Download, FileJson, Loader2, Play, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { examprepApi, type QuizQuestion } from "@/lib/playgroundApi";
import { errorText, usePlayground } from "../PlaygroundGate";

export const QUIZ_KEY = "exam-questions";

function isQuestionBank(data: unknown): data is QuizQuestion[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every(
      (q) =>
        q && typeof q.question === "string" && Array.isArray(q.options) && Array.isArray(q.answer) && q.id !== undefined
    )
  );
}

function download(questions: QuizQuestion[], name = "questions.json") {
  const url = URL.createObjectURL(new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const ExamPrepHome = () => {
  const navigate = useNavigate();
  const session = usePlayground();
  const jsonRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [converting, setConverting] = useState<string>("");
  const [converted, setConverted] = useState<{ name: string; questions: QuizQuestion[] } | null>(null);
  const hasSaved = (() => {
    try {
      return !!sessionStorage.getItem(QUIZ_KEY);
    } catch {
      return false;
    }
  })();

  const start = (questions: QuizQuestion[]) => {
    sessionStorage.setItem(QUIZ_KEY, JSON.stringify(questions));
    navigate("/examprep/quiz");
  };

  const loadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(String(ev.target?.result));
        if (!isQuestionBank(data)) throw new Error();
        start(data);
      } catch {
        toast.error("That file isn't a question bank JSON. Use “Convert Doc to JSON” to create one.");
      }
    };
    reader.readAsText(file);
  };

  const convertDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || converting) return;
    setConverted(null);
    setConverting(file.name);
    try {
      const res = await examprepApi.convert(session.token, file);
      const name = file.name.replace(/\.[^.]+$/, "") || "questions";
      setConverted({ name, questions: res.questions });
      toast.success(`${res.questions.length} questions ready`);
    } catch (err) {
      const msg = errorText(session, err, "Conversion failed");
      if (msg) toast.error(msg);
    } finally {
      setConverting("");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute h-[500px] w-[500px] rounded-full bg-primary/[0.04] blur-[100px]" />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
        <Link to="/" className="mb-6 flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-warm shadow-glow md:h-20 md:w-20"
        >
          <BookOpen className="h-8 w-8 text-primary-foreground md:h-10 md:w-10" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-4 text-center font-display text-4xl font-bold tracking-tight md:text-5xl"
        >
          Exam <span className="text-gradient">Prep</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-10 max-w-lg text-center text-sm leading-relaxed text-muted-foreground md:text-base"
        >
          Turn a document into a question bank, then get quizzed — questions and answers are shuffled every time. Flag tricky
          questions, track your progress, and download your results.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <button
            onClick={() => docRef.current?.click()}
            disabled={!!converting}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-all hover:shadow-md disabled:cursor-wait"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              {converting ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <FileJson className="h-5 w-5 text-primary" />}
            </div>
            <div>
              <h3 className="font-display text-sm font-bold">Convert Doc to JSON</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload a PDF, DOCX or TXT. AI extracts its multiple-choice questions (or writes some from the material).
              </p>
            </div>
            <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-primary opacity-80 group-hover:opacity-100">
              {converting ? (
                <span className="truncate">Converting {converting}…</span>
              ) : (
                <>
                  Upload file <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </div>
          </button>

          <button
            onClick={() => jsonRef.current?.click()}
            className="group flex flex-col items-start gap-3 rounded-2xl bg-primary p-6 text-left text-primary-foreground shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/15">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold">Load JSON & Start</h3>
              <p className="mt-1 text-xs text-primary-foreground/75">Upload your question bank JSON file and begin the quiz immediately</p>
            </div>
            <div className="mt-auto flex items-center gap-1.5 text-xs font-medium opacity-80 group-hover:opacity-100">
              Upload file <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </motion.div>

        {converted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex w-full max-w-lg flex-col gap-3 rounded-2xl border-2 border-success/40 bg-success/5 p-4 sm:flex-row sm:items-center"
          >
            <p className="flex-1 text-sm">
              <span className="font-semibold">{converted.questions.length} questions</span> from {converted.name}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => download(converted.questions, `${converted.name}.json`)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" /> Download JSON
              </button>
              <button
                onClick={() => start(converted.questions)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-medium text-success-foreground hover:opacity-90"
              >
                <Play className="h-3.5 w-3.5" /> Start quiz
              </button>
            </div>
          </motion.div>
        )}

        {hasSaved && !converted && (
          <button onClick={() => navigate("/examprep/quiz")} className="mt-6 text-sm font-medium text-primary hover:underline">
            Continue your last quiz →
          </button>
        )}

        <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden" onChange={loadJson} />
        <input ref={docRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={convertDoc} />
      </div>
    </div>
  );
};

export default ExamPrepHome;
