import { previewOutputs } from "../outputPreview";
import { clampNumber } from "../truncate";
import { ToolResult } from "../types";
import { activeNotebookOrError, isToolError, ok, ToolContext } from "./common";

export type GetCellOutputsArgs = {
  cellIndex: number;
  maxChars?: number;
};

export function getCellOutputs(ctx: ToolContext, args: GetCellOutputsArgs): ToolResult<{
  cellIndex: number;
  outputs: ReturnType<typeof previewOutputs>;
}> {
  const notebook = activeNotebookOrError(ctx.state);
  if (isToolError(notebook)) {
    return notebook;
  }

  const config = ctx.config.getConfig();
  if (!config.includeOutputs) {
    return { ok: false, reason: "outputs_disabled_by_setting" };
  }

  const cell = notebook.cells.find((candidate) => candidate.index === args.cellIndex);
  if (!cell) {
    return { ok: false, reason: "cell_not_found" };
  }

  const maxChars = clampNumber(args.maxChars, config.maxOutputChars, 1, config.maxOutputChars);
  return ok({
    cellIndex: cell.index,
    outputs: previewOutputs(cell.outputs, maxChars)
  });
}
