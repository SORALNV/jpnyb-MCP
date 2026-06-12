import { summarizeOutputs } from "../outputPreview";
import { clampNumber } from "../truncate";
import { ToolResult } from "../types";
import { activeNotebookOrError, isToolError, ok, sourcePreview, ToolContext } from "./common";

export type GetVisibleCellsArgs = {
  maxCharsPerCell?: number;
};

export function getVisibleCells(ctx: ToolContext, args: GetVisibleCellsArgs = {}): ToolResult<{
  cells: {
    index: number;
    kind: "code" | "markup";
    languageId: string;
    source: ReturnType<typeof sourcePreview>;
    execution: unknown;
    outputs: ReturnType<typeof summarizeOutputs>;
  }[];
}> {
  const notebook = activeNotebookOrError(ctx.state);
  if (isToolError(notebook)) {
    return notebook;
  }

  const config = ctx.config.getConfig();
  const maxChars = clampNumber(args.maxCharsPerCell, config.maxCharsPerCell, 1, config.maxCharsPerCell);
  const visibleIndexes = new Set<number>();
  for (const range of notebook.visibleRanges) {
    for (let index = range.start; index < range.end; index += 1) {
      visibleIndexes.add(index);
    }
  }

  const cells = notebook.cells
    .filter((cell) => visibleIndexes.has(cell.index))
    .map((cell) => ({
      index: cell.index,
      kind: cell.kind,
      languageId: cell.languageId,
      source: sourcePreview(cell.source, maxChars),
      execution: cell.execution,
      outputs: summarizeOutputs(cell.outputs, config.includeOutputs, config.maxOutputChars)
    }));

  return ok({ cells });
}
