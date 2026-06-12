import { summarizeOutputs } from "../outputPreview";
import { ToolResult } from "../types";
import { activeNotebookOrError, isToolError, ok, sourcePreview, ToolContext } from "./common";

export function getFocusedCell(ctx: ToolContext): ToolResult<{
  index: number;
  kind: "code" | "markup";
  languageId: string;
  source: ReturnType<typeof sourcePreview>;
  execution: unknown;
  outputs: ReturnType<typeof summarizeOutputs>;
}> {
  const notebook = activeNotebookOrError(ctx.state);
  if (isToolError(notebook)) {
    return notebook;
  }

  const config = ctx.config.getConfig();
  const cell = notebook.cells.find((candidate) => candidate.index === notebook.focusedCellIndex);
  if (!cell) {
    return { ok: false, reason: "focused_cell_not_found" };
  }

  return ok({
    index: cell.index,
    kind: cell.kind,
    languageId: cell.languageId,
    source: sourcePreview(cell.source, config.maxCharsPerCell),
    execution: cell.execution,
    outputs: summarizeOutputs(cell.outputs, config.includeOutputs, config.maxOutputChars)
  });
}
