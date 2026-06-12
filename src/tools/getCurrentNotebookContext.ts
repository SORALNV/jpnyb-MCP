import { ToolResult } from "../types";
import { activeNotebookOrError, isToolError, ok, ToolContext } from "./common";

export function getCurrentNotebookContext(ctx: ToolContext): ToolResult<{
  notebookPath: string;
  relativePath: string | null;
  notebookType: string;
  cellCount: number;
  selections: { start: number; end: number }[];
  focusedCellIndex: number | null;
  visibleRanges: { start: number; end: number }[];
  lastExecutedCell: { index: number; execution: unknown } | null;
  recentExecutions: { index: number; executionOrder?: number; success?: boolean; endTime?: number }[];
}> {
  const notebook = activeNotebookOrError(ctx.state);
  if (isToolError(notebook)) {
    return notebook;
  }

  const lastExecuted = ctx.state.getLastExecutedCell();
  const recentExecutions = ctx.state.getRecentExecutionHistory(5).map((entry) => ({
    index: entry.index,
    executionOrder: entry.executionOrder,
    success: entry.success,
    endTime: entry.endTime
  }));

  return ok({
    notebookPath: notebook.notebookPath,
    relativePath: notebook.relativePath,
    notebookType: notebook.notebookType,
    cellCount: notebook.cellCount,
    selections: notebook.selections,
    focusedCellIndex: notebook.focusedCellIndex,
    visibleRanges: notebook.visibleRanges,
    lastExecutedCell: lastExecuted ? { index: lastExecuted.cell.index, execution: lastExecuted.cell.execution } : null,
    recentExecutions
  });
}
