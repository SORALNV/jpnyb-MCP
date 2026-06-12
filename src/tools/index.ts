import * as z from "zod/v4";
import { getCellOutputs } from "./getCellOutputs";
import { getCurrentNotebookContext } from "./getCurrentNotebookContext";
import { getFocusedCell } from "./getFocusedCell";
import { getLastExecutedCell } from "./getLastExecutedCell";
import { getRecentExecutionHistory } from "./getRecentExecutionHistory";
import { getVisibleCells } from "./getVisibleCells";
import { toMcpResult, ToolContext } from "./common";

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema?: z.ZodRawShape;
  handler: (args: any, ctx: ToolContext) => object;
};

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "get_current_notebook_context",
    title: "Get Current Notebook Context",
    description: "Return path, type, selection, visible ranges, and recent execution summary for the active notebook.",
    handler: (_args, ctx) => getCurrentNotebookContext(ctx)
  },
  {
    name: "get_focused_cell",
    title: "Get Focused Cell",
    description: "Return source, execution summary, and output metadata for the focused notebook cell.",
    handler: (_args, ctx) => getFocusedCell(ctx)
  },
  {
    name: "get_visible_cells",
    title: "Get Visible Cells",
    description: "Return source, execution summary, and output metadata for visible notebook cells.",
    inputSchema: {
      maxCharsPerCell: z.number().int().positive().optional()
    },
    handler: (args, ctx) => getVisibleCells(ctx, args)
  },
  {
    name: "get_last_executed_cell",
    title: "Get Last Executed Cell",
    description: "Return the most recently executed cell for the active notebook.",
    handler: (_args, ctx) => getLastExecutedCell(ctx)
  },
  {
    name: "get_recent_execution_history",
    title: "Get Recent Execution History",
    description: "Return recent in-memory execution history for the active notebook.",
    inputSchema: {
      limit: z.number().int().positive().max(50).optional()
    },
    handler: (args, ctx) => getRecentExecutionHistory(ctx, args)
  },
  {
    name: "get_cell_outputs",
    title: "Get Cell Outputs",
    description: "Return text previews for text-like outputs and metadata for binary outputs for one cell.",
    inputSchema: {
      cellIndex: z.number().int().nonnegative(),
      maxChars: z.number().int().positive().optional()
    },
    handler: (args, ctx) => getCellOutputs(ctx, args)
  }
];

export function createMcpToolCallback(definition: ToolDefinition, ctx: ToolContext) {
  return async (args: any) => {
    const result = definition.handler(args ?? {}, ctx);
    return toMcpResult(result);
  };
}
