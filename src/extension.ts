import * as vscode from "vscode";
import { affectsServerLifecycle, ExtensionConfigReader } from "./config";
import { NotebookMcpServer, PortInUseError } from "./mcpServer";
import { NotebookState } from "./notebookState";
import { agentsSnippet, codexTomlSnippet } from "./snippets";
import { getCurrentNotebookContext } from "./tools/getCurrentNotebookContext";

let mcpServer: NotebookMcpServer | undefined;
let notebookState: NotebookState | undefined;
let configReader: ExtensionConfigReader | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  configReader = new ExtensionConfigReader();
  notebookState = new NotebookState();
  mcpServer = new NotebookMcpServer(notebookState, configReader);
  outputChannel = vscode.window.createOutputChannel("Notebook MCP");
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

  context.subscriptions.push(notebookState, outputChannel, statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("notebookMcp.startServer", async () => {
      await startServerWithNotification();
    }),
    vscode.commands.registerCommand("notebookMcp.stopServer", async () => {
      await mcpServer?.stop();
      updateStatusBar();
      void vscode.window.showInformationMessage("Notebook MCP サーバーを停止しました。");
    }),
    vscode.commands.registerCommand("notebookMcp.showCurrentContext", () => {
      showCurrentContext();
    }),
    vscode.commands.registerCommand("notebookMcp.copyCodexConfig", async () => {
      const port = configReader!.getConfig().port;
      await vscode.env.clipboard.writeText(codexTomlSnippet(port));
      void vscode.window.showInformationMessage("Codex 用 MCP 設定をクリップボードへコピーしました。");
    }),
    vscode.commands.registerCommand("notebookMcp.copyAgentsSnippet", async () => {
      const port = configReader!.getConfig().port;
      await vscode.env.clipboard.writeText(agentsSnippet(port));
      void vscode.window.showInformationMessage("AGENTS.md 用スニペットをクリップボードへコピーしました。");
    }),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (!affectsServerLifecycle(event)) {
        return;
      }

      const config = configReader!.getConfig();
      if (config.enabled) {
        await startServerWithNotification();
      } else {
        await mcpServer?.stop();
        updateStatusBar();
      }
    })
  );

  updateStatusBar();
  if (configReader.getConfig().enabled) {
    await startServerWithNotification();
  }
}

export async function deactivate(): Promise<void> {
  await mcpServer?.stop();
  mcpServer = undefined;
  notebookState?.dispose();
  notebookState = undefined;
}

async function startServerWithNotification(): Promise<void> {
  if (!mcpServer || !configReader) {
    return;
  }

  const config = configReader.getConfig();
  try {
    await mcpServer.start(config.port);
  } catch (error) {
    updateStatusBar();
    if (error instanceof PortInUseError) {
      const action = await vscode.window.showWarningMessage(
        `Notebook MCP サーバーを開始できません。ポート ${error.port} はすでに使用されています。`,
        "設定を開く"
      );
      if (action === "設定を開く") {
        await vscode.commands.executeCommand("workbench.action.openSettings", "notebookMcp.port");
      }
      return;
    }

    throw error;
  }

  updateStatusBar();
}

function showCurrentContext(): void {
  if (!notebookState || !configReader || !outputChannel) {
    return;
  }

  const result = getCurrentNotebookContext({ state: notebookState, config: configReader });
  outputChannel.clear();
  outputChannel.appendLine(JSON.stringify(result, null, 2));
  outputChannel.show(true);
}

function updateStatusBar(): void {
  if (!statusBarItem || !mcpServer) {
    return;
  }

  if (mcpServer.isRunning && mcpServer.currentPort) {
    statusBarItem.text = `MCP :${mcpServer.currentPort}`;
    statusBarItem.tooltip = `Notebook MCP server: http://127.0.0.1:${mcpServer.currentPort}/mcp`;
    statusBarItem.command = "notebookMcp.showCurrentContext";
  } else {
    statusBarItem.text = "MCP off";
    statusBarItem.tooltip = "Notebook MCP server is stopped";
    statusBarItem.command = "notebookMcp.startServer";
  }

  statusBarItem.show();
}
