import React from "react";

interface MessageContentProps {
    text: string;
    isAI?: boolean;
}

/**
 * Lightweight markdown renderer for chat messages.
 * Supports: bold, italic, code, headers, lists, line breaks.
 */
const MessageContent: React.FC<MessageContentProps> = ({ text, isAI = false }) => {
    // Split text into lines for processing
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Code block (```...```)
        if (trimmed.startsWith("```")) {
            const codeLines: string[] = [line.substring(line.indexOf("```") + 3)];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith("```")) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length) i++; // Skip closing ```

            const codeContent = codeLines.join("\n").trim();
            if (codeContent) {
                elements.push(
                    <pre
                        key={elements.length}
                        className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-2 rounded text-xs overflow-x-auto my-1"
                    >
                        <code>{codeContent}</code>
                    </pre>
                );
            }
            continue;
        }

        // Headers (## Title, ### Subtitle, etc.)
        const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            const headerText = headerMatch[2];
            const headerClass = {
                1: "text-lg font-bold",
                2: "text-base font-bold",
                3: "text-sm font-semibold",
                4: "text-sm font-semibold",
                5: "text-xs font-semibold",
                6: "text-xs font-semibold",
            }[level] || "text-base font-bold";

            elements.push(
                <div key={elements.length} className={`${headerClass} mt-2 mb-1`}>
                    {parseInlineMarkdown(headerText)}
                </div>
            );
            i++;
            continue;
        }

        // Unordered list (-, *)
        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            const listItems: string[] = [];
            while (
                i < lines.length &&
                (lines[i].trim().startsWith("-") || lines[i].trim().startsWith("*"))
            ) {
                const itemText = lines[i].trim().substring(1).trim();
                listItems.push(itemText);
                i++;
            }

            elements.push(
                <ul key={elements.length} className="list-disc list-inside my-1 ml-2">
                    {listItems.map((item, idx) => (
                        <li key={idx} className="text-sm">
                            {parseInlineMarkdown(item)}
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        // Regular paragraph
        if (trimmed) {
            elements.push(
                <p key={elements.length} className="my-1">
                    {parseInlineMarkdown(trimmed)}
                </p>
            );
        }

        i++;
    }

    return <div className="whitespace-pre-wrap break-words">{elements}</div>;
};

/**
 * Parse inline markdown elements: bold, italic, inline code, links.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Pattern for: **bold**, *italic*, `code`, [link](url)
    const pattern = /(\*\*[^\*]+\*\*|\*[^\*]+\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }

        const matched = match[0];

        // Bold
        if (matched.startsWith("**") && matched.endsWith("**")) {
            parts.push(
                <strong key={parts.length} className="font-semibold">
                    {matched.substring(2, matched.length - 2)}
                </strong>
            );
        }
        // Italic
        else if (matched.startsWith("*") && matched.endsWith("*")) {
            parts.push(
                <em key={parts.length} className="italic">
                    {matched.substring(1, matched.length - 1)}
                </em>
            );
        }
        // Inline code
        else if (matched.startsWith("`") && matched.endsWith("`")) {
            parts.push(
                <code
                    key={parts.length}
                    className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono"
                >
                    {matched.substring(1, matched.length - 1)}
                </code>
            );
        }
        // Link
        else if (matched.startsWith("[") && matched.includes("](")) {
            const linkMatch = matched.match(/\[([^\]]+)\]\(([^\)]+)\)/);
            if (linkMatch) {
                parts.push(
                    <a
                        key={parts.length}
                        href={linkMatch[2]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                    >
                        {linkMatch[1]}
                    </a>
                );
            }
        }

        lastIndex = match.index + matched.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
}

export default MessageContent;
