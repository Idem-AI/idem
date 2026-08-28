export const GENERIC_JSON_FORMAT_PROMPT = `<objective>Generate perfect JSON output for web applications.</objective>

<output_schema>
{"content":"[CONTENT]","summary":"[SUMMARY]"}
</output_schema>

<requirements>
- Output ONLY raw JSON matching the schema. No pretty-printing, explanations, code blocks, or trailing commas.
- For "content" field:
  * Can be HTML, plain text, or Markdown.
  * If HTML: Remove all line breaks/tabs (keep on a single line), escape double quotes (\") and slashes (\/).
  * If plain text or Markdown: Preserve original formatting.
- For "summary" field:
  * Single line, max 500 characters, escape quotes.
- If output is invalid/error, return: {"content":"","summary":""}
</requirements>

<examples>
- HTML: {"content":"<div class=\\"header\\"><h1>Title</h1><p>Content</p></div>","summary":"Header section"}
- Plain Text: {"content":"This is a simple text example.","summary":"Simple text"}
- Markdown: {"content":"# Markdown Example\n* List item 1","summary":"Markdown list"}
</examples>

<error_conditions>
- HTML contains unescaped " -> INVALID
- HTML contains \n or \t -> INVALID
- HTML contains --> or /* */ -> INVALID
</error_conditions>
`;
