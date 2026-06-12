import * as vscode from "vscode";
import {
  CellKind,
  CellOutputSnapshot,
  CellSnapshot,
  ExecSummary,
  ExecutionHistoryEntry,
  NotebookSnapshot,
  NotebookStateReader
} from "./types";

const HISTORY_LIMIT = 50;

export class NotebookState implements NotebookStateReader, vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly historyByNotebook = new Map<string, ExecutionHistoryEntry[]>();
  private readonly summarySignatures = new Map<string, string>();

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeNotebookDocument((event) => this.recordExecutionChanges(event)),
      vscode.window.onDidChangeActiveNotebookEditor(() => undefined),
      vscode.window.onDidChangeNotebookEditorSelection(() => undefined),
      vscode.window.onDidChangeNotebookEditorVisibleRanges(() => undefined)
    );
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
    this.historyByNotebook.clear();
    this.summarySignatures.clear();
  }

  getActiveNotebook(): NotebookSnapshot | null {
    const editor = vscode.window.activeNotebookEditor;
    if (!editor) {
      return null;
    }

    const notebook = editor.notebook;
    const cells = notebook.getCells().map((cell) => toCellSnapshot(cell));
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(notebook.uri);

    return {
      notebookPath: notebook.uri.fsPath,
      relativePath: workspaceFolder ? vscode.workspace.asRelativePath(notebook.uri, false) : null,
      notebookType: notebook.notebookType,
      cellCount: notebook.cellCount,
      selections: editor.selections.map((range) => ({ start: range.start, end: range.end })),
      focusedCellIndex: editor.selection ? editor.selection.start : null,
      visibleRanges: editor.visibleRanges.map((range) => ({ start: range.start, end: range.end })),
      cells
    };
  }

  getRecentExecutionHistory(limit: number): ExecutionHistoryEntry[] {
    const active = this.getActiveNotebook();
    if (!active) {
      return [];
    }

    return sortHistory(this.historyByNotebook.get(active.notebookPath) ?? []).slice(0, limit);
  }

  getLastExecutedCell(): { cell: CellSnapshot; fromLiveHistory: boolean } | null {
    const active = this.getActiveNotebook();
    if (!active) {
      return null;
    }

    const historyEntry = this.getRecentExecutionHistory(1)[0];
    if (historyEntry) {
      const historyCell = active.cells.find((cell) => cell.index === historyEntry.index);
      if (historyCell) {
        return { cell: historyCell, fromLiveHistory: true };
      }
    }

    const fallback = active.cells
      .filter((cell) => cell.execution?.executionOrder !== undefined)
      .sort((a, b) => (b.execution?.executionOrder ?? -1) - (a.execution?.executionOrder ?? -1))[0];

    return fallback ? { cell: fallback, fromLiveHistory: false } : null;
  }

  private recordExecutionChanges(event: vscode.NotebookDocumentChangeEvent): void {
    const notebookPath = event.notebook.uri.fsPath;
    for (const change of event.cellChanges) {
      if (!change.executionSummary) {
        continue;
      }

      const execution = toExecutionSummary(change.executionSummary);
      if (!execution || !hasExecutionSignal(execution)) {
        continue;
      }

      const key = `${notebookPath}:${change.cell.index}`;
      const signature = JSON.stringify(execution);
      if (this.summarySignatures.get(key) === signature) {
        continue;
      }
      this.summarySignatures.set(key, signature);

      const entries = this.historyByNotebook.get(notebookPath) ?? [];
      entries.push({
        notebookUri: notebookPath,
        index: change.cell.index,
        executionOrder: execution.executionOrder,
        success: execution.success,
        startTime: execution.startTime,
        endTime: execution.endTime,
        source: change.cell.document.getText()
      });

      this.historyByNotebook.set(notebookPath, entries.slice(-HISTORY_LIMIT));
    }
  }
}

function toCellSnapshot(cell: vscode.NotebookCell): CellSnapshot {
  return {
    index: cell.index,
    kind: toCellKind(cell.kind),
    languageId: cell.document.languageId,
    source: cell.document.getText(),
    execution: toExecutionSummary(cell.executionSummary),
    outputs: cell.outputs.map(toOutputSnapshot)
  };
}

function toCellKind(kind: vscode.NotebookCellKind): CellKind {
  return kind === vscode.NotebookCellKind.Code ? "code" : "markup";
}

function toExecutionSummary(summary: vscode.NotebookCellExecutionSummary | undefined): ExecSummary {
  if (!summary) {
    return null;
  }

  return {
    executionOrder: summary.executionOrder,
    success: summary.success,
    startTime: summary.timing?.startTime,
    endTime: summary.timing?.endTime
  };
}

function toOutputSnapshot(output: vscode.NotebookCellOutput): CellOutputSnapshot {
  return {
    items: output.items.map((item) => ({
      mime: item.mime,
      data: item.data,
      sizeBytes: item.data.byteLength
    }))
  };
}

function hasExecutionSignal(summary: Exclude<ExecSummary, null>): boolean {
  return summary.executionOrder !== undefined || summary.startTime !== undefined || summary.endTime !== undefined;
}

function sortHistory(entries: ExecutionHistoryEntry[]): ExecutionHistoryEntry[] {
  return [...entries].sort((a, b) => {
    const orderA = a.executionOrder ?? Number.NEGATIVE_INFINITY;
    const orderB = b.executionOrder ?? Number.NEGATIVE_INFINITY;
    if (orderA !== orderB) {
      return orderB - orderA;
    }

    const endA = a.endTime ?? Number.NEGATIVE_INFINITY;
    const endB = b.endTime ?? Number.NEGATIVE_INFINITY;
    return endB - endA;
  });
}
