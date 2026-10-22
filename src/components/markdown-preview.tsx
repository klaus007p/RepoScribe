"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownPreview({ markdown }: { markdown: string }) {
    return (
        <div className="prose-doc text-sm leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                            {children}
                        </a>
                    ),
                }}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    );
}