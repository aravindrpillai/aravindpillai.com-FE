import { BookOpen, FileSearch, Wallet } from "lucide-react";
import type { AppMeta } from "./PlaygroundGate";

/** What the access gate shows for each playground app. Codes + free-trial switch: admin panel -> Playground. */
export const EXAMPREP: AppMeta = {
  title: "ExamPrep",
  tagline: "Turn any document into a multiple-choice quiz and practise until you know it.",
  icon: BookOpen,
};

export const FILE_ANALYSER: AppMeta = {
  title: "File Analyser",
  tagline: "Upload documents and ask questions — answers cite the file they came from.",
  icon: FileSearch,
};

export const FINANCE: AppMeta = {
  title: "FinanceAI",
  tagline: "Answer a short questionnaire and get a personalised financial health report.",
  icon: Wallet,
};
