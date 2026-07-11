export function applyTitleTransform(record) {
  if (record.titleTransform === "strip_prefix") {
    if (
      !record.titlePrefix ||
      record.titlePrefix + record.titleJa !== record.titleOriginal
    ) {
      throw new Error(
        `titlePrefix concatenation mismatch: ${record.titleOriginal}`,
      );
    }
    return record.titleJa;
  }
  if (record.titleJa !== record.titleOriginal) {
    throw new Error(`verbatim title mismatch: ${record.titleOriginal}`);
  }
  return record.titleJa;
}

const MARKERS = {
  exact_marker: /^## 投稿本文\s*$/m,
  decorated_marker: /^## 投稿本文（[^）]*）\s*$/m,
  xcopy_marker: /^## Xコピペ形式（投稿本文）\s*$/m,
};

const h2LineIndex = (lines, heading) =>
  lines.findIndex((line) => line.trim() === heading.trim());

export function extractBody(sourceMarkdown, declaration) {
  let text = sourceMarkdown.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const markerPattern = MARKERS[declaration.bodySelector];
  if (markerPattern) {
    const markerMatch = text.match(markerPattern);
    if (!markerMatch) {
      throw new Error(
        `declared marker not found (${declaration.bodySelector})`,
      );
    }
    text = text.slice(markerMatch.index + markerMatch[0].length);
  } else if (declaration.bodySelector !== "full_after_frontmatter") {
    throw new Error(
      `extractBody does not handle selector ${declaration.bodySelector}`,
    );
  }

  let lines = text.split("\n");
  const allH2s = lines
    .filter((line) => /^## /.test(line))
    .map((line) => line.trim());
  const publicSet = new Set(
    declaration.publicH2s.map((heading) => heading.trim()),
  );
  const internalSet = new Set(
    declaration.internalH2s.map((heading) => heading.trim()),
  );
  for (const heading of allH2s) {
    if (!publicSet.has(heading) && !internalSet.has(heading)) {
      throw new Error(`uncovered H2 (unresolved): ${heading}`);
    }
  }

  if (declaration.internalH2s.length > 0) {
    const indexes = declaration.internalH2s
      .map((heading) => h2LineIndex(lines, heading))
      .filter((index) => index !== -1);
    if (indexes.length !== declaration.internalH2s.length) {
      throw new Error("declared internal H2s not found");
    }
    const firstInternal = Math.min(...indexes);
    const publicAfterCut = declaration.publicH2s.some(
      (heading) => h2LineIndex(lines, heading) > firstInternal,
    );
    if (publicAfterCut) {
      throw new Error(
        "internal H2 interleaves before a public H2 — needs bodyPatch or exclusion",
      );
    }
    lines = lines.slice(0, firstInternal);
  }

  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  if (declaration.leadDuplicateLine) {
    if (lines[0]?.trim() !== declaration.leadDuplicateLine.trim()) {
      throw new Error(`leadDuplicateLine mismatch: ${lines[0]}`);
    }
    lines.shift();
  }
  while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop();
  if (declaration.trailingHashtagLine) {
    if (lines.at(-1)?.trim() !== declaration.trailingHashtagLine.trim()) {
      throw new Error("trailingHashtagLine mismatch");
    }
    lines.pop();
  }
  return lines.join("\n").trim();
}

export function escapeMdx(body) {
  const segments = body.split(/(```[\s\S]*?```)/);
  return segments
    .map((segment, index) =>
      index % 2 === 1
        ? segment
        : segment.replace(/[{}<]/g, (character) => `\\${character}`),
    )
    .join("");
}

export function publishedLabelFromJst(publishedAtJst) {
  const match = publishedAtJst.match(
    /^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
  );
  if (!match) {
    throw new Error(`invalid publishedAtJst: ${publishedAtJst}`);
  }
  return `${match[1]}-${match[2]} ${match[3]}:${match[4]} 公開`;
}

export function applyBodyPatch(body, bodyPatch) {
  if (!bodyPatch) return body;
  let patched = body;
  for (const { from, to, expectedCount } of bodyPatch.replacements) {
    const actualCount = patched.split(from).length - 1;
    if (actualCount !== expectedCount) {
      throw new Error(
        `bodyPatch expectedCount mismatch for ${JSON.stringify(from)}: expected ${expectedCount}, found ${actualCount}`,
      );
    }
    patched = patched.split(from).join(to);
  }
  return patched;
}

export function extractH2s(body) {
  return [...body.matchAll(/^## .*$/gm)].map((match) => match[0]);
}

export function buildMeta(record) {
  const meta = {
    articleId: record.slug,
    family: record.family,
    titleJa: record.titleJa,
    publishedAtJst: record.publishedAtJst,
    publishedLabel: publishedLabelFromJst(record.publishedAtJst),
    lanes: record.lanes,
  };
  if (record.dataDate) meta.dataDate = record.dataDate;
  if (record.sourceXUrl) meta.sourceXUrl = record.sourceXUrl;
  return meta;
}
