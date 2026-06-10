import sanitizeHtml from "sanitize-html";

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "pre",
      "code",
      "span",
      "div",
      "table",
      "colgroup",
      "col",
      "thead",
      "tbody",
      "tr",
      "th",
      "td"
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      code: ["class"],
      pre: ["class"],
      span: ["class", "style"],
      div: ["class", "style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      p: ["style"],
      table: ["class"],
      th: ["colspan", "rowspan", "colwidth"],
      td: ["colspan", "rowspan", "colwidth"],
      col: ["style"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/]
      },
      col: {
        width: [/^\d+(px|%)$/]
      }
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noreferrer", target: "_blank" })
    }
  });
}

export function excerptFromHtml(html: string, maxLength = 160): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}...`;
}
