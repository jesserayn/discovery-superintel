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

  for (const rawLine of lines) {
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
      push({ string: listMatch[2].trim(), heading: 0, depth, isList: true });
      continue;
    }

    lastListDepth = null;
    if (paragraph) {
      paragraph.string += ` ${content}`;
    } else {
      paragraph = {
        string: content,
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

export const CONTINUATION_GUIDANCE =
  "**Continuing the conversation:** write your follow-up in a new block under this answer, focus it, and run Roam Discover Superintelligence: Ask AI again. Select any earlier blocks to include them as context.";

export function frameResponse({ providerLabel, model, body }) {
  const header = `Answered by ${providerLabel} (\`${model}\`)`;
  return `${header}\n\n${String(body || "").trim()}\n\n---\n${CONTINUATION_GUIDANCE}`;
}
