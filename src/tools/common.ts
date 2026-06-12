import { ConfigReader, NotebookSnapshot, NotebookStateReader, SourcePreview, ToolError, ToolResult } from "../types";
import { truncateText } from "../truncate";

export type ToolContext = {
  state: NotebookStateReader;
  config: ConfigReader;
};

export function activeNotebookOrError(state: NotebookStateReader): NotebookSnapshot | ToolError {
  const notebook = state.getActiveNotebook();
  if (!notebook) {
    return { ok: false, reason: "no_active_notebook" };
  }
  return notebook;
}

export function isToolError(value: NotebookSnapshot | ToolError): value is ToolError {
  return "ok" in value && value.ok === false;
}

export function sourcePreview(text: string, maxChars: number): SourcePreview {
  return truncateText(text, maxChars);
}

export function ok<T extends object>(value: T): ToolResult<T> {
  return {
    ok: true,
    ...value
  };
}

export function toMcpResult(result: object): { content: { type: "text"; text: string }[]; structuredContent: Record<string, unknown> } {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result)
      }
    ],
    structuredContent: result as Record<string, unknown>
  };
}
