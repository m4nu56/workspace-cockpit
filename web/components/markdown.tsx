import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Header files and reports; the header block itself is shown by the form, not here. */
export function Markdown({ text }: { text: string }) {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  return (
    <div className="prose-cockpit text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
