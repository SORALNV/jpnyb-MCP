import * as assert from "node:assert/strict";
import { getCellOutputs } from "../../tools/getCellOutputs";
import { getCurrentNotebookContext } from "../../tools/getCurrentNotebookContext";
import { getFocusedCell } from "../../tools/getFocusedCell";
import { getLastExecutedCell } from "../../tools/getLastExecutedCell";
import { getRecentExecutionHistory } from "../../tools/getRecentExecutionHistory";
import { getVisibleCells } from "../../tools/getVisibleCells";
import {
  ConfigReader,
  ExecutionHistoryEntry,
  NotebookMcpConfig,
  NotebookSnapshot,
  NotebookStateReader
} from "../../types";

const encoder = new TextEncoder();

suite("tool handlers", () => {
  const config: NotebookMcpConfig = {
    enabled: true,
    port: 47321,
    maxCharsPerCell: 4,
    maxOutputChars: 3,
    includeOutputs: true,
    readOnly: true
  };

  test("returns parseable no-active-notebook errors", () => {
    const ctx = makeContext(null, [], config);
    assert.deepEqual(getCurrentNotebookContext(ctx), { ok: false, reason: "no_active_notebook" });
    assert.deepEqual(getFocusedCell(ctx), { ok: false, reason: "no_active_notebook" });
  });

  test("returns current context", () => {
    const ctx = makeContext(makeNotebook(), [], config);
    const result = getCurrentNotebookContext(ctx);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.notebookPath, "/tmp/demo.ipynb");
      assert.equal(result.cellCount, 2);
      assert.equal(result.focusedCellIndex, 0);
    }
  });

  test("returns focused and visible cells with truncation", () => {
    const ctx = makeContext(makeNotebook(), [], config);
    const focused = getFocusedCell(ctx);
    const visible = getVisibleCells(ctx, { maxCharsPerCell: 2 });

    assert.equal(focused.ok, true);
    assert.equal(visible.ok, true);
    if (focused.ok) {
      assert.deepEqual(focused.source, { text: "prin", truncated: true, totalChars: 11 });
      assert.equal(focused.outputs.truncated, true);
    }
    if (visible.ok) {
      assert.equal(visible.cells.length, 2);
      assert.deepEqual(visible.cells[0].source, { text: "pr", truncated: true, totalChars: 11 });
    }
  });

  test("returns last executed cell and sorted history", () => {
    const history: ExecutionHistoryEntry[] = [
      { notebookUri: "/tmp/demo.ipynb", index: 0, executionOrder: 1, endTime: 10, source: "old" },
      { notebookUri: "/tmp/demo.ipynb", index: 1, executionOrder: 2, endTime: 20, success: true, source: "newer" }
    ];
    const ctx = makeContext(makeNotebook(), history, config);

    const last = getLastExecutedCell(ctx);
    const recent = getRecentExecutionHistory(ctx, { limit: 10 });

    assert.equal(last.ok, true);
    assert.equal(recent.ok, true);
    if (last.ok) {
      assert.equal(last.index, 1);
      assert.equal(last.fromLiveHistory, true);
    }
    if (recent.ok) {
      assert.deepEqual(recent.entries.map((entry) => entry.index), [1, 0]);
      assert.deepEqual(recent.entries[0].source, { text: "newe", truncated: true, totalChars: 5 });
    }
  });

  test("returns output previews or disabled error", () => {
    const enabledCtx = makeContext(makeNotebook(), [], config);
    const disabledCtx = makeContext(makeNotebook(), [], { ...config, includeOutputs: false });

    const enabled = getCellOutputs(enabledCtx, { cellIndex: 0, maxChars: 2 });
    const disabled = getCellOutputs(disabledCtx, { cellIndex: 0 });

    assert.equal(enabled.ok, true);
    if (enabled.ok) {
      assert.equal(enabled.outputs[0].items[0].textPreview, "ou");
      assert.equal(enabled.outputs[0].items[1].sizeBytes, 3);
      assert.equal(enabled.outputs[0].items[1].textPreview, undefined);
    }
    assert.deepEqual(disabled, { ok: false, reason: "outputs_disabled_by_setting" });
  });
});

function makeContext(notebook: NotebookSnapshot | null, history: ExecutionHistoryEntry[], config: NotebookMcpConfig) {
  const state: NotebookStateReader = {
    getActiveNotebook: () => notebook,
    getRecentExecutionHistory: (limit) => [...history]
      .sort((a, b) => (b.executionOrder ?? -1) - (a.executionOrder ?? -1))
      .slice(0, limit),
    getLastExecutedCell: () => {
      if (!notebook) {
        return null;
      }
      const entry = [...history].sort((a, b) => (b.executionOrder ?? -1) - (a.executionOrder ?? -1))[0];
      if (entry) {
        const cell = notebook.cells.find((candidate) => candidate.index === entry.index);
        return cell ? { cell, fromLiveHistory: true } : null;
      }
      const fallback = notebook.cells.find((cell) => cell.execution?.executionOrder !== undefined);
      return fallback ? { cell: fallback, fromLiveHistory: false } : null;
    }
  };
  const configReader: ConfigReader = {
    getConfig: () => config
  };
  return { state, config: configReader };
}

function makeNotebook(): NotebookSnapshot {
  return {
    notebookPath: "/tmp/demo.ipynb",
    relativePath: "demo.ipynb",
    notebookType: "jupyter-notebook",
    cellCount: 2,
    selections: [{ start: 0, end: 1 }],
    focusedCellIndex: 0,
    visibleRanges: [{ start: 0, end: 2 }],
    cells: [
      {
        index: 0,
        kind: "code",
        languageId: "python",
        source: "print('hi')",
        execution: { executionOrder: 1, success: true, endTime: 10 },
        outputs: [
          {
            items: [
              { mime: "text/plain", data: encoder.encode("output"), sizeBytes: 6 },
              { mime: "image/png", data: new Uint8Array([1, 2, 3]), sizeBytes: 3 }
            ]
          }
        ]
      },
      {
        index: 1,
        kind: "markup",
        languageId: "markdown",
        source: "# Title",
        execution: null,
        outputs: []
      }
    ]
  };
}
