import * as assert from "node:assert/strict";
import { previewOutputs, summarizeOutputs } from "../../outputPreview";
import { CellOutputSnapshot } from "../../types";

const encoder = new TextEncoder();

suite("outputPreview", () => {
  test("decodes and truncates text-like MIME items", () => {
    const outputs: CellOutputSnapshot[] = [
      {
        items: [
          {
            mime: "text/plain",
            data: encoder.encode("abcdef"),
            sizeBytes: 6
          }
        ]
      }
    ];

    assert.deepEqual(previewOutputs(outputs, 3), [
      {
        items: [
          {
            mime: "text/plain",
            textPreview: "abc",
            truncated: true,
            sizeBytes: 6
          }
        ]
      }
    ]);
    assert.deepEqual(summarizeOutputs(outputs, true, 3), {
      outputCount: 1,
      mimeTypes: ["text/plain"],
      truncated: true
    });
  });

  test("keeps binary output metadata only", () => {
    const outputs: CellOutputSnapshot[] = [
      {
        items: [
          {
            mime: "image/png",
            data: new Uint8Array([1, 2, 3]),
            sizeBytes: 3
          }
        ]
      }
    ];

    assert.deepEqual(previewOutputs(outputs, 10), [
      {
        items: [
          {
            mime: "image/png",
            sizeBytes: 3
          }
        ]
      }
    ]);
  });

  test("keeps html output metadata only", () => {
    const outputs: CellOutputSnapshot[] = [
      {
        items: [
          {
            mime: "text/html",
            data: encoder.encode("<script>secret()</script>"),
            sizeBytes: 25
          }
        ]
      }
    ];

    assert.deepEqual(previewOutputs(outputs, 100), [
      {
        items: [
          {
            mime: "text/html",
            sizeBytes: 25
          }
        ]
      }
    ]);
  });

  test("reduces VS Code error output to name and message", () => {
    const data = JSON.stringify({
      name: "ValueError",
      message: "bad value",
      traceback: ["secret line 1", "secret line 2"]
    });
    const outputs: CellOutputSnapshot[] = [
      {
        items: [
          {
            mime: "application/vnd.code.notebook.error",
            data: encoder.encode(data),
            sizeBytes: data.length
          }
        ]
      }
    ];

    assert.deepEqual(previewOutputs(outputs, 100), [
      {
        items: [
          {
            mime: "application/vnd.code.notebook.error",
            textPreview: "ValueError: bad value",
            truncated: true,
            sizeBytes: data.length
          }
        ]
      }
    ]);
  });

  test("hides MIME details when outputs are disabled", () => {
    assert.deepEqual(summarizeOutputs([{ items: [] }], false, 10), {
      outputCount: 1,
      mimeTypes: [],
      truncated: false
    });
  });
});
