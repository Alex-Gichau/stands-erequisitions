import React from "react";

/**
 * Applies text formatting (bold, italic, bullet list, numbered list) to a textarea input.
 */
export function applyTextFormatting(
  textarea: HTMLTextAreaElement | null,
  value: string,
  setValue: (val: string) => void,
  formatType: "bold" | "italic" | "bullet" | "number"
) {
  if (!textarea) {
    if (formatType === "bold") setValue(value ? `${value} **bold text**` : "**bold text**");
    else if (formatType === "italic") setValue(value ? `${value} *italic text*` : "*italic text*");
    else if (formatType === "bullet") setValue(value ? `${value}\n- List item` : "- List item");
    else if (formatType === "number") setValue(value ? `${value}\n1. List item` : "1. List item");
    return;
  }

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = value.substring(start, end);

  let replacement = "";
  let cursorOffset = 0;

  if (formatType === "bold") {
    if (selectedText) {
      replacement = `**${selectedText}**`;
      cursorOffset = replacement.length;
    } else {
      replacement = "**bold text**";
      cursorOffset = 11; // place cursor inside tags
    }
  } else if (formatType === "italic") {
    if (selectedText) {
      replacement = `*${selectedText}*`;
      cursorOffset = replacement.length;
    } else {
      replacement = "*italic text*";
      cursorOffset = 12; // place cursor inside tags
    }
  } else if (formatType === "bullet") {
    if (selectedText) {
      replacement = selectedText
        .split("\n")
        .map(line => line.startsWith("- ") ? line : `- ${line}`)
        .join("\n");
      cursorOffset = replacement.length;
    } else {
      const prefix = (start > 0 && value[start - 1] !== "\n") ? "\n- " : "- ";
      replacement = `${prefix}list item`;
      cursorOffset = replacement.length;
    }
  } else if (formatType === "number") {
    if (selectedText) {
      replacement = selectedText
        .split("\n")
        .map((line, idx) => /^\d+\.\s/.test(line) ? line : `${idx + 1}. ${line}`)
        .join("\n");
      cursorOffset = replacement.length;
    } else {
      const prefix = (start > 0 && value[start - 1] !== "\n") ? "\n1. " : "1. ";
      replacement = `${prefix}numbered item`;
      cursorOffset = replacement.length;
    }
  }

  const newValue = value.substring(0, start) + replacement + value.substring(end);
  setValue(newValue);

  // Restore focus and cursor selection
  setTimeout(() => {
    textarea.focus();
    if (selectedText) {
      textarea.setSelectionRange(start, start + cursorOffset);
    } else {
      textarea.setSelectionRange(start + cursorOffset - 9, start + cursorOffset - 2);
    }
  }, 10);
}

/**
 * Parses markdown-inspired comment text containing bold (**text**), italic (*text*),
 * lists (- item or 1. item), line breaks, and @mentions into React nodes.
 */
export function renderFormattedCommentText(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");

  let inBulletList = false;
  let inNumberedList = false;
  let currentListItems: React.ReactNode[] = [];
  const resultElements: React.ReactNode[] = [];

  const flushList = (keyPrefix: string) => {
    if (inBulletList && currentListItems.length > 0) {
      resultElements.push(
        <ul key={`ul-${keyPrefix}`} className="list-disc list-inside space-y-1 my-1.5 pl-1 text-slate-800 dark:text-slate-200">
          {currentListItems}
        </ul>
      );
      currentListItems = [];
      inBulletList = false;
    } else if (inNumberedList && currentListItems.length > 0) {
      resultElements.push(
        <ol key={`ol-${keyPrefix}`} className="list-decimal list-inside space-y-1 my-1.5 pl-1 text-slate-800 dark:text-slate-200">
          {currentListItems}
        </ol>
      );
      currentListItems = [];
      inNumberedList = false;
    }
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    const isBullet = /^(?:\*|-)\s+(.+)/.test(trimmed);
    const isNumber = /^\d+\.\s+(.+)/.test(trimmed);

    if (isBullet) {
      const match = trimmed.match(/^(?:\*|-)\s+(.+)/);
      const content = match ? match[1] : trimmed;
      if (inNumberedList) flushList(`line-${lineIdx}`);
      inBulletList = true;
      currentListItems.push(
        <li key={`bullet-${lineIdx}`} className="leading-relaxed">
          {parseInlineFormatting(content)}
        </li>
      );
    } else if (isNumber) {
      const match = trimmed.match(/^\d+\.\s+(.+)/);
      const content = match ? match[1] : trimmed;
      if (inBulletList) flushList(`line-${lineIdx}`);
      inNumberedList = true;
      currentListItems.push(
        <li key={`num-${lineIdx}`} className="leading-relaxed">
          {parseInlineFormatting(content)}
        </li>
      );
    } else {
      flushList(`line-${lineIdx}`);
      if (lineIdx > 0 && line === "") {
        resultElements.push(<div key={`blank-${lineIdx}`} className="h-1.5" />);
      } else {
        resultElements.push(
          <p key={`p-${lineIdx}`} className="leading-relaxed my-0.5">
            {parseInlineFormatting(line)}
          </p>
        );
      }
    }
  });

  flushList("final");

  return <div className="space-y-0.5">{resultElements}</div>;
}

// Inline formatting parser for bold, italic, and @mentions
function parseInlineFormatting(str: string): React.ReactNode[] {
  if (!str) return [];

  const tokenRegex = /(@[A-Za-z0-9._-]+(?:\s+[A-Za-z0-9._-]+)?)|(?:\*\*|__)(.*?)(?:\*\*|__)|(?:\*|_)(.*?)(?:\*|_)/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(str)) !== null) {
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      nodes.push(str.substring(lastIndex, matchIndex));
    }

    const fullMatch = match[0];
    const mention = match[1];
    const boldText = match[2];
    const italicText = match[3];

    if (mention) {
      nodes.push(
        <span
          key={`mention-${matchIndex}`}
          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-100/90 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] border border-indigo-200/60 dark:border-indigo-800/60 mx-0.5 shadow-2xs"
        >
          {mention}
        </span>
      );
    } else if (boldText !== undefined) {
      nodes.push(
        <strong key={`bold-${matchIndex}`} className="font-extrabold text-slate-900 dark:text-white">
          {boldText}
        </strong>
      );
    } else if (italicText !== undefined) {
      nodes.push(
        <em key={`italic-${matchIndex}`} className="italic font-medium">
          {italicText}
        </em>
      );
    } else {
      nodes.push(fullMatch);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < str.length) {
    nodes.push(str.substring(lastIndex));
  }

  return nodes;
}
