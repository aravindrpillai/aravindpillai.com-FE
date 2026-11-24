import { useRef, type MouseEvent } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import { ArrowUpRight, FileSearch, GraduationCap, LineChart, Wallet, type LucideIcon } from "lucide-react";

/**
 * Project cards on the home page (inside the AI section): Stocks, FinanceAI, File Analyser and ExamPrep.
 * Every card links to a route in this site and opens it in a new tab.
 */
interface Project {
  title: string;
  tagline: string;
  description: string;
  tags: string[];
  icon: LucideIcon;
  /** In-site route (see App.tsx). Opens in a new tab. */
  href: string;
  /** Small pill on the card: how visitors get in. */
  access: string;
  /** Two HSL colours for the card's accent gradient. */
  from: string;
  to: string;
}

export const PROJECTS: Project[] = [
  {
    title: "Stocks",
    tagline: "News in, top picks out",
    description: "Reads the market news, runs the numbers on every ticker, has Claude review the shortlist and ranks the best picks.",
    tags: ["Market news", "Analysis", "Claude review"],
    icon: LineChart,
    href: "/stocks",
    access: "Invite only",
    from: "152 60% 42%",
    to: "190 70% 45%",
  },
  {
    title: "FinanceAI",
    tagline: "A health check for your wallet",
    description: "Answer a few questions about income, spending and goals. Get a health score, budget breakdown and a plan to fix it.",
    tags: ["Health score", "Budget", "Recommendations"],
    icon: Wallet,
    href: "/finance-advisor",
    access: "30-min free trial",
    from: "24 80% 55%",
    to: "350 70% 60%",
  },
  {
    title: "File Analyser",
    tagline: "Chat with your documents",
    description: "Drop in PDFs or text files and ask questions. Answers come back with the exact passages they were drawn from.",
    tags: ["Multi-file", "RAG", "Cited answers"],
    icon: FileSearch,
    href: "/file-analyser",
    access: "30-min free trial",
    from: "220 75% 58%",
    to: "262 70% 62%",
  },
  {
    title: "ExamPrep",
    tagline: "Turn notes into a quiz",
    description: "Upload a question bank or study notes and practise with an interactive quiz: flag questions, check answers, track progress.",
    tags: ["Upload", "Quiz mode", "Progress"],
    icon: GraduationCap,
    href: "/examprep",
    access: "30-min free trial",
    from: "280 60% 58%",
    to: "320 70% 60%",
  },
];

const grid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const card: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 120, damping: 18 } },
};

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const Icon = project.icon;

  // Pointer position inside the card, 0..1. Drives the tilt and the spotlight.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 200, damping: 20, mass: 0.5 };
  const rotateX = useSpring(useTransform(py, [0, 1], [7, -7]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-7, 7]), spring);
  const spotX = useTransform(px, (v) => `${v * 100}%`);
  const spotY = useTransform(py, (v) => `${v * 100}%`);
  const spotlight = useMotionTemplate`radial-gradient(420px circle at ${spotX} ${spotY}, hsl(${project.from} / 0.16), transparent 60%)`;

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  const gradient = `linear-gradient(135deg, hsl(${project.from}) 0%, hsl(${project.to}) 100%)`;

  const body = (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
      whileHover={reduce ? undefined : { y: -6 }}
      whileTap={{ scale: 0.98 }}
      className="group relative h-full overflow-hidden rounded-3xl border border-border bg-card p-7 shadow-soft transition-shadow duration-500 hover:shadow-xl"
    >
      {/* gradient hairline on top, grows on hover */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 origin-left scale-x-[0.25] transition-transform duration-500 ease-out group-hover:scale-x-100"
        style={{ background: gradient }}
      />
      {/* pointer spotlight */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: spotlight }}
      />
      {/* soft blob in the corner */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ background: gradient }}
        animate={reduce ? undefined : { scale: [1, 1.15, 1], rotate: [0, 30, 0] }}
        transition={{ repeat: Infinity, duration: 9 + index * 1.5, ease: "easeInOut" }}
      />

      <div className="relative flex h-full flex-col">
        <div className="mb-6 flex items-start justify-between">
          <motion.div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ background: gradient, boxShadow: `0 10px 30px -10px hsl(${project.from} / 0.6)` }}
            animate={reduce ? undefined : { y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 4, delay: index * 0.4, ease: "easeInOut" }}
          >
            <Icon size={26} strokeWidth={2} className="transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110" />
          </motion.div>
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-all duration-300 group-hover:border-transparent group-hover:text-white">
            <span
              aria-hidden
              className="absolute h-10 w-10 scale-0 rounded-full transition-transform duration-300 group-hover:scale-100"
              style={{ background: gradient }}
            />
            <ArrowUpRight
              size={18}
              className="relative transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </span>
        </div>

        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: `hsl(${project.from})` }}>
            {project.tagline}
          </p>
          <span
            className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
            style={{ borderColor: `hsl(${project.from} / 0.35)`, color: `hsl(${project.from})`, background: `hsl(${project.from} / 0.08)` }}
          >
            {project.access}
          </span>
        </div>
        <h3 className="mb-3 font-display text-2xl font-bold md:text-3xl">{project.title}</h3>
        <p className="mb-6 flex-1 font-body leading-relaxed text-muted-foreground">{project.description}</p>

        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag, i) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 + index * 0.12 + i * 0.07, duration: 0.4 }}
              className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground/80"
            >
              {tag}
            </motion.span>
          ))}
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.li variants={card} className="h-full list-none">
      <a
        href={project.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${project.title} (new tab)`}
        className="block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {body}
      </a>
    </motion.li>
  );
}

/** The project cards grid. Rendered inside the "So I Poked the AI Bear" section (AISection). */
const ProjectsGrid = () => (
  <div className="relative">
    {/* faint drifting background glow */}
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-gradient-warm opacity-[0.07] blur-3xl"
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
    />
    <motion.ul
      className="grid gap-6 text-left md:grid-cols-2"
      variants={grid}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
    >
      {PROJECTS.map((p, i) => (
        <ProjectCard key={p.title} project={p} index={i} />
      ))}
    </motion.ul>
  </div>
);

export default ProjectsGrid;
