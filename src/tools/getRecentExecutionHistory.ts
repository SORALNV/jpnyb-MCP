import { clampNumber } from "../truncate";
import { ToolResult } from "../types";
import { activeNotebookOrError, isToolError, ok, sourcePreview, ToolContext } from "./common";

export type GetRecentExecutionHistoryArgs = {
  limit?: number;
};

export function getRecentExecutionHistory(ctx: ToolContext, args: GetRecentExecutionHistoryArgs = {}): ToolResult<{
  entries: {
    index: number;
    executionOrder?: number;
    success?: boolean;
    startTime?: number;
    endTime?: number;
    source: ReturnType<typeof sourcePreview>;
  }[];
}> {
  const notebook = activeNotebookOrError(ctx.state);
  if (isToolError(notebook)) {
    return notebook;
  }

  const config = ctx.config.getConfig();
  const limit = clampNumber(args.limit, 10, 1, 50);
  const entries = ctx.state.getRecentExecutionHistory(limit).map((entry) => ({
    index: entry.index,
    executionOrder: entry.executionOrder,
    success: entry.success,
    startTime: entry.startTime,
    endTime: entry.endTime,
    source: sourcePreview(entry.source, config.maxCharsPerCell)
  }));

  return ok({ entries });
}
