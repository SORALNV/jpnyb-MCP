export type CellKind = "code" | "markup";

export type ExecSummary = {
  executionOrder?: number;
  success?: boolean;
  startTime?: number;
  endTime?: number;
} | null;

export type SourcePreview = {
  text: string;
  truncated: boolean;
  totalChars: number;
};

export type CellRef = {
  index: number;
  kind: CellKind;
  languageId: string;
};

export type OutputPreviewMeta = {
  outputCount: number;
  mimeTypes: string[];
  truncated: boolean;
};

export type OutputItemSnapshot = {
  mime: string;
  data?: Uint8Array;
  sizeBytes: number;
};

export type CellOutputSnapshot = {
  items: OutputItemSnapshot[];
};

export type CellSnapshot = CellRef & {
  source: string;
  execution: ExecSummary;
  outputs: CellOutputSnapshot[];
};

export type NotebookSnapshot = {
  notebookPath: string;
  relativePath: string | null;
  notebookType: string;
  cellCount: number;
  selections: RangeDto[];
  focusedCellIndex: number | null;
  visibleRanges: RangeDto[];
  cells: CellSnapshot[];
};

export type RangeDto = {
  start: number;
  end: number;
};

export type ExecutionHistoryEntry = {
  notebookUri: string;
  index: number;
  executionOrder?: number;
  success?: boolean;
  startTime?: number;
  endTime?: number;
  source: string;
};

export type ToolOk<T extends object> = T & { ok: true };

export type ToolErrorReason =
  | "no_active_notebook"
  | "focused_cell_not_found"
  | "last_executed_cell_not_found"
  | "cell_not_found"
  | "outputs_disabled_by_setting";

export type ToolError = {
  ok: false;
  reason: ToolErrorReason;
};

export type ToolResult<T extends object> = ToolOk<T> | ToolError;

export type NotebookMcpConfig = {
  enabled: boolean;
  port: number;
  maxCharsPerCell: number;
  maxOutputChars: number;
  includeOutputs: boolean;
  readOnly: boolean;
};

export type ConfigReader = {
  getConfig(): NotebookMcpConfig;
};

export type NotebookStateReader = {
  getActiveNotebook(): NotebookSnapshot | null;
  getRecentExecutionHistory(limit: number): ExecutionHistoryEntry[];
  getLastExecutedCell(): { cell: CellSnapshot; fromLiveHistory: boolean } | null;
};
