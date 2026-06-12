import * as vscode from "vscode";
import { clampNumber } from "./truncate";
import { NotebookMcpConfig } from "./types";

const DEFAULT_CONFIG: NotebookMcpConfig = {
  enabled: true,
  port: 47321,
  maxCharsPerCell: 4000,
  maxOutputChars: 2000,
  includeOutputs: true,
  readOnly: true
};

export class ExtensionConfigReader {
  getConfig(): NotebookMcpConfig {
    const config = vscode.workspace.getConfiguration("notebookMcp");

    return {
      enabled: config.get<boolean>("enabled", DEFAULT_CONFIG.enabled),
      port: clampNumber(config.get("port"), DEFAULT_CONFIG.port, 1, 65535),
      maxCharsPerCell: clampNumber(config.get("maxCharsPerCell"), DEFAULT_CONFIG.maxCharsPerCell, 1, 200000),
      maxOutputChars: clampNumber(config.get("maxOutputChars"), DEFAULT_CONFIG.maxOutputChars, 1, 200000),
      includeOutputs: config.get<boolean>("includeOutputs", DEFAULT_CONFIG.includeOutputs),
      readOnly: config.get<boolean>("readOnly", DEFAULT_CONFIG.readOnly)
    };
  }
}

export function affectsServerLifecycle(event: vscode.ConfigurationChangeEvent): boolean {
  return event.affectsConfiguration("notebookMcp.enabled") || event.affectsConfiguration("notebookMcp.port");
}
