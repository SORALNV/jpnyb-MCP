import { summarizeOutputs } from "../outputPreview";
import { ToolResult } from "../types";
import { activeNotebookOrError, isToolError, ok, sourcePreview, ToolContext } from "./common";

export function getLastExecutedCell(ctx: ToolContext): ToolResult<{
  index: number;
  source: ReturnType<typeof sourcePreview>;
  execution: unknown;
  outputs: ReturnType<typeof summarizeOutputs>;
  fromLiveHistory: boolean;
}> {
  const notebook = activeNotebookOrError(ctx.state);
  if (isToolError(notebook)) {
    return notebook;
  }

  const lastExecuted = ctx.state.getLastExecutedCell();
  if (!lastExecuted) {
    return { ok: false, reason: "last_executed_cell_not_found" };
  }

  const config = ctx.config.getConfig();
  return ok({
    index: lastExecuted.cell.index,
    source: sourcePreview(lastExecuted.cell.source, config.maxCharsPerCell),
    execution: lastExecuted.cell.execution,
    outputs: summarizeOutputs(lastExecuted.cell.outputs, config.includeOutputs, config.maxOutputChars),
    fromLiveHistory: lastExecuted.fromLiveHistory
  });
}
