"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "@/components/CodeBlock";
import type { Components } from "react-markdown";

const components: Components = {
  // Strip the default <pre> wrapper; CodeBlock provides its own container
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className ?? "");
    const content = String(children);
    // Fenced code: has a language class, or content spans multiple lines
    const isBlock = !!match || (content.includes("\n") && content.trim().length > 0);

    if (isBlock) {
      return (
        <CodeBlock language={match?.[1] ?? ""}>
          {content.replace(/\n$/, "")}
        </CodeBlock>
      );
    }

    return (
      <code className="font-mono text-[0.85em] bg-muted px-1 py-0.5 rounded">
        {children}
      </code>
    );
  },
};

interface Props {
  content: string;
}

export default function MarkdownRenderer({ content }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
