import { CellOutputSnapshot, OutputPreviewMeta } from "./types";
import { truncateText } from "./truncate";

const TEXT_LIKE_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/json",
  "application/vnd.code.notebook.stdout",
  "application/vnd.code.notebook.stderr",
  "application/vnd.code.notebook.error"
]);

export type OutputItemPreview = {
  mime: string;
  textPreview?: string;
  truncated?: boolean;
  sizeBytes?: number;
};

export type OutputPreview = {
  items: OutputItemPreview[];
};

export function isTextLikeMime(mime: string): boolean {
  return TEXT_LIKE_MIME_TYPES.has(mime);
}

export function summarizeOutputs(outputs: CellOutputSnapshot[], includeOutputs: boolean, maxChars: number): OutputPreviewMeta {
  if (!includeOutputs) {
    return {
      outputCount: outputs.length,
      mimeTypes: [],
      truncated: false
    };
  }

  const mimeTypes = new Set<string>();
  let truncated = false;

  for (const output of outputs) {
    for (const item of output.items) {
      mimeTypes.add(item.mime);
      if (isTextLikeMime(item.mime) && item.data) {
        const preview = decodeTextOutput(item.mime, item.data, maxChars);
        truncated = truncated || preview.truncated;
      }
    }
  }

  return {
    outputCount: outputs.length,
    mimeTypes: Array.from(mimeTypes).sort(),
    truncated
  };
}

export function previewOutputs(outputs: CellOutputSnapshot[], maxChars: number): OutputPreview[] {
  return outputs.map((output) => ({
    items: output.items.map((item) => {
      if (isTextLikeMime(item.mime) && item.data) {
        const preview = decodeTextOutput(item.mime, item.data, maxChars);
        return {
          mime: item.mime,
          textPreview: preview.text,
          truncated: preview.truncated,
          sizeBytes: item.sizeBytes
        };
      }

      return {
        mime: item.mime,
        sizeBytes: item.sizeBytes
      };
    })
  }));
}

function decodeTextOutput(mime: string, data: Uint8Array, maxChars: number): { text: string; truncated: boolean } {
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(data);
  if (mime === "application/vnd.code.notebook.error") {
    const errorText = toErrorNameAndMessage(decoded);
    const preview = truncateText(errorText, maxChars);
    return {
      text: preview.text,
      truncated: preview.truncated || errorText.length < decoded.length
    };
  }

  const preview = truncateText(decoded, maxChars);
  return {
    text: preview.text,
    truncated: preview.truncated
  };
}

function toErrorNameAndMessage(decoded: string): string {
  try {
    const value = JSON.parse(decoded) as { name?: unknown; message?: unknown };
    const name = typeof value.name === "string" ? value.name : "Error";
    const message = typeof value.message === "string" ? value.message : decoded;
    return `${name}: ${message}`;
  } catch {
    return decoded.split(/\r?\n/).slice(0, 2).join("\n");
  }
}
