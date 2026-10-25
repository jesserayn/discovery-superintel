export function splitParagraphs(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const LIST_RE = /^(\s*)(?:[-*+•]|\d+[.)]|[a-zA-Z][.)])\s+(.+)$/;
const RULE_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const TASK_RE = /^\[( |x|X)\]\s+(.+)$/;
const ROAM_TASK_RE = /^\{\{\[\[(?:TODO|DONE)\]\]\}\}/;

// Roam renders a block starting {{[[TODO]]}} / {{[[DONE]]}} as a checkbox.
// Models also emit [ ] / [x], [[to-do]], and {{todo}}, which would otherwise
// land as literal text or a [[to-do]] page reference instead of a checkbox.
const BRACKET_TASK_RE =
  /^(?:\{\{\[\[|\[\[)(to[-\s_]?do|done)\]\](?:\}\})?\s*[:\-]?\s+(.+)$/i;
const CURLY_TASK_RE = /^\{\{(to[-\s_]?do|done)\}\}\s*[:\-]?\s+(.+)$/i;
const PLAIN_TASK_RE = /^to[-\s]do\s*[:\-]\s+(.+)$/i;

function taskPrefix(word, label) {
  const done = word.toLowerCase().replace(/[-\s_]/g, "") === "done";
  return `{{[[${done ? "DONE" : "TODO"}]]}} ${label.trim()}`;
}

function roamTaskString(text, fromList = false) {
  const trimmed = String(text || "").trim();
  if (ROAM_TASK_RE.test(trimmed)) return trimmed;
  const checkbox = trimmed.match(TASK_RE);
  if (checkbox) {
    const label = checkbox[2].trim();
    if (label) {
      return `{{[[${checkbox[1].toLowerCase() === "x" ? "DONE" : "TODO"}]]}} ${label}`;
    }
  }
  const bracket = trimmed.match(BRACKET_TASK_RE) || trimmed.match(CURLY_TASK_RE);
  if (bracket) return taskPrefix(bracket[1], bracket[2]);
  if (fromList) {
    const plain = trimmed.match(PLAIN_TASK_RE);
    if (plain) return taskPrefix("todo", plain[1]);
  }
  return trimmed;
}

function boldify(line) {
  const trimmed = String(line || "").trim();
  if (/^\*\*.+\*\*$/.test(trimmed)) return trimmed;
  return `**${trimmed}**`;
}

export function markdownToRoamBlocks(text, options = {}) {
  const { headings = false } = options;
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");

  let minHeading = null;
  for (const line of lines) {
    const match = line.trim().match(HEADING_RE);
    if (match) {
      minHeading =
        minHeading === null ? match[1].length : Math.min(minHeading, match[1].length);
    }
  }
  minHeading = minHeading ?? 1;

  const blocks = [];
  let headingDepth = -1;
  let lastListDepth = null;
  let paragraph = null;
  let inCodeBlock = false;
  let codeLines = [];

  const baseDepth = () => (headingDepth >= 0 ? headingDepth + 1 : 0);
  const flushParagraph = () => {
    if (!paragraph) return;
    blocks.push(paragraph);
    paragraph = null;
  };
  const push = (node) => {
    flushParagraph();
    blocks.push(node);
    return node;
  };

  const parseTableRow = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(/(?<!\\)\|/)
      .map((cell) => cell.replace(/\\\|/g, "|").trim());

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();

    if (inCodeBlock) {
      codeLines.push(rawLine);
      if (trimmed.startsWith("```")) {
        push({ string: codeLines.join("\n"), heading: 0, depth: baseDepth(), isList: false });
        inCodeBlock = false;
        codeLines = [];
      }
      continue;
    }
    if (trimmed.startsWith("```")) {
      inCodeBlock = true;
      codeLines = [rawLine];
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    if (RULE_RE.test(trimmed)) {
      flushParagraph();
      continue;
    }

    // Markdown table: consecutive pipe lines become one block per row,
    // "**ID** — value" (extra columns labelled by their header).
    if (trimmed.startsWith("|")) {
      const run = [];
      let end = lineIndex;
      while (end < lines.length && lines[end].trim().startsWith("|")) {
        run.push(lines[end]);
        end += 1;
      }
      const rows = run.map(parseTableRow);
      const isSeparator = (cells) =>
        cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
      if (rows.length >= 2 && isSeparator(rows[1] || [])) {
        const headers = rows[0];
        const twoCol = headers.length === 2;
        flushParagraph();
        lastListDepth = baseDepth();
        for (const cells of rows.slice(2)) {
          if (!cells.some(Boolean)) continue;
          const [first, ...rest] = cells;
          const parts = rest
            .map((value, i) => {
              if (!value) return "";
              const label = headers[i + 1];
              return !twoCol && label ? `${label}: ${value}` : value;
            })
            .filter(Boolean);
          push({
            string: parts.length ? `**${first}** — ${parts.join("; ")}` : first,
            heading: 0,
            depth: baseDepth(),
            isList: true,
          });
        }
        lineIndex = end - 1;
        continue;
      }
      // Not a table (no separator row): fall through as plain text.
    }

    const indent = Math.floor((rawLine.match(/^[ \t]*/)[0].replace(/\t/g, "  ").length || 0) / 2);
    const content = trimmed.replace(/^>\s?/, "");

    const headingMatch = content.match(HEADING_RE);
    if (headingMatch) {
      const depth = headingMatch[1].length - minHeading;
      headingDepth = depth;
      lastListDepth = null;
      const title = headingMatch[2].trim();
      push({
        string: headings ? title : boldify(title),
        heading: headings ? Math.min(depth + 1, 3) : 0,
        depth,
        isList: false,
      });
      continue;
    }

    const listMatch = rawLine.match(LIST_RE);
    if (listMatch && !content.startsWith("```")) {
      let depth;
      if (lastListDepth !== null && indent === 0) {
        depth = lastListDepth;
      } else if (blocks.length && !blocks[blocks.length - 1].isList && indent === 0 && !paragraph) {
        depth = blocks[blocks.length - 1].depth + 1;
      } else {
        depth = baseDepth() + indent;
      }
      if (paragraph) depth = paragraph.depth + 1;
      lastListDepth = depth;
      push({ string: roamTaskString(listMatch[2], true), heading: 0, depth, isList: true });
      continue;
    }

    lastListDepth = null;
    if (paragraph) {
      paragraph.string += ` ${content}`;
    } else {
      paragraph = {
        string: roamTaskString(content),
        heading: 0,
        depth: baseDepth() + indent,
        isList: false,
      };
    }
  }
  flushParagraph();
  if (inCodeBlock && codeLines.length) {
    blocks.push({ string: codeLines.join("\n"), heading: 0, depth: baseDepth(), isList: false });
  }

  if (!blocks.length) return blocks;
  const minDepth = Math.min(...blocks.map((block) => block.depth));
  return blocks.map(({ isList, ...block }) => ({
    ...block,
    depth: block.depth - minDepth,
  }));
}

export function buildUserContent({ prompt, contextText }) {
  const question = String(prompt || "").trim();
  const context = String(contextText || "").trim();
  if (!context) return question;
  return `Context:\n${context}\n\nRequest:\n${question}`;
}

const ANSWER_HEADER_RE =
  /^Answered by .+ \(`[^`]+`(?:, effort `[^`]+`)?\)(?: · context: .+)?$/;

export function isAnswerHeader(text) {
  return ANSWER_HEADER_RE.test(String(text || "").trim());
}

function isContinuationGuidance(text) {
  return String(text || "")
    .trim()
    .startsWith("**Continuing the conversation:**");
}

// Providers need alternating user/assistant turns starting with user
// (Anthropic rejects anything else). Merge same-role neighbours, drop
// empty turns, and park a leading assistant turn behind a user lead-in.
export function normalizeMessages(messages) {
  const normalized = [];
  for (const message of messages || []) {
    const content = String(message?.content || "").trim();
    if (!content) continue;
    const role = message.role === "assistant" ? "assistant" : "user";
    const last = normalized[normalized.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      normalized.push({ role, content });
    }
  }
  if (normalized.length && normalized[0].role === "assistant") {
    normalized.unshift({
      role: "user",
      content: "Continue from the following conversation.",
    });
  }
  return normalized;
}

// Build the chat messages for a request. When the context entries contain
// a prior answer (thread follow-up, or a selected Q&A subtree), replay
// them as alternating turns so the model can tell its own answers from
// the user's notes. Otherwise keep the single Context/Request message.
export function buildMessages({ prompt, contextText, contextEntries }) {
  const entries = (contextEntries || []).filter(
    (entry) => entry && String(entry.text || "").trim(),
  );
  const hasPriorAnswer = entries.some(
    (entry) => entry.role === "assistant" || isAnswerHeader(entry.text),
  );
  if (!hasPriorAnswer) {
    return [
      { role: "user", content: buildUserContent({ prompt, contextText }) },
    ];
  }

  const turns = [];
  let role = "user";
  for (const entry of entries) {
    const text = String(entry.text).trim();
    if (isAnswerHeader(text)) {
      role = "assistant";
      continue;
    }
    if (isContinuationGuidance(text)) continue;
    const entryRole =
      entry.role === "assistant" || entry.role === "user" ? entry.role : role;
    role = entryRole;
    turns.push({ role: entryRole, content: text });
  }
  const question = String(prompt || "").trim();
  if (question) turns.push({ role: "user", content: question });
  return normalizeMessages(turns);
}

export const CONTINUATION_GUIDANCE =
  "**Continuing the conversation:** write your follow-up in a new block under this answer, focus it, and run Discovery Superintel: Ask AI again. Select any earlier blocks to include them as context.";

export function buildAnswerContent(body, showContinuationNote = true) {
  const text = String(body || "").trim();
  if (!showContinuationNote) return text;
  return `${text}\n\n---\n${CONTINUATION_GUIDANCE}`;
}

export function frameResponse({
  providerLabel,
  model,
  effort = null,
  body,
  contextLabel = null,
}) {
  const base = effort
    ? `Answered by ${providerLabel} (\`${model}\`, effort \`${effort}\`)`
    : `Answered by ${providerLabel} (\`${model}\`)`;
  const header = contextLabel ? `${base} · ${contextLabel}` : base;
  return `${header}\n\n${String(body || "").trim()}\n\n---\n${CONTINUATION_GUIDANCE}`;
}
