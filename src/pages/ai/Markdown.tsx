import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="not-prose my-4 overflow-hidden rounded-xl border border-border bg-[#1e1f24] text-[#e6e6e6]">
      <div className="flex items-center justify-between px-4 py-1.5 text-xs text-white/60 bg-white/5">
        <span>{lang || "code"}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Model output -> HTML. react-markdown never renders raw HTML, so model text cannot inject markup. */
function MarkdownImpl({ text }: { text: string }) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:leading-7 prose-pre:p-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none prose-headings:font-semibold prose-a:text-primary">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _n, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          pre: ({ children }) => <>{children}</>,
          code: ({ node: _n, className, children, ...props }) => {
            const match = /language-([\w+-]+)/.exec(className || "");
            const content = String(children ?? "");
            const isBlock = !!match || content.includes("\n");
            if (!isBlock) {
              return (
                <code className="rounded-md bg-muted px-1.5 py-0.5 text-[0.85em] font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock lang={match?.[1] || ""} code={content.replace(/\n$/, "")} />;
          },
          table: ({ children }) => (
            <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:px-3 [&_td]:py-2 [&_tr]:border-b [&_tr]:border-border">
                {children}
              </table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
