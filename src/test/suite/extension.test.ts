import * as assert from "node:assert/strict";
import * as http from "node:http";
import * as path from "node:path";
import * as vscode from "vscode";

suite("Notebook MCP extension", () => {
  const port = 48321;

  suiteSetup(async () => {
    await vscode.workspace.getConfiguration("notebookMcp").update("port", port, vscode.ConfigurationTarget.Global);
    await vscode.workspace.getConfiguration("notebookMcp").update("enabled", true, vscode.ConfigurationTarget.Global);
    const extension = vscode.extensions.getExtension("local.vscode-notebook-mcp");
    await extension?.activate();
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand("notebookMcp.stopServer");
  });

  test("starts server and rejects invalid paths and hosts", async () => {
    await vscode.commands.executeCommand("notebookMcp.startServer");

    const missing = await fetch(`http://127.0.0.1:${port}/missing`);
    assert.equal(missing.status, 404);

    const badHost = await postWithHost(port, "example.com");
    assert.equal(badHost.statusCode, 403);
  });

  test("handles initialize and a context tool call", async () => {
    await vscode.commands.executeCommand("notebookMcp.startServer");
    await openFixtureNotebook();

    const initialize = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "integration-test", version: "0.1.0" }
        }
      })
    });

    assert.equal(initialize.status, 200);
    const sessionId = initialize.headers.get("mcp-session-id");
    assert.ok(sessionId);

    const toolCall = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json, text/event-stream",
        "mcp-session-id": sessionId
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "get_current_notebook_context",
          arguments: {}
        }
      })
    });

    assert.equal(toolCall.status, 200);
    const body = await toolCall.json() as any;
    const text = body.result.content[0].text;
    const context = JSON.parse(text);
    assert.equal(context.ok, true);
    assert.ok(context.cellCount >= 1);
  });
});

async function openFixtureNotebook(): Promise<void> {
  const fixture = vscode.Uri.file(path.resolve(__dirname, "../../../src/test/fixtures/sample.ipynb"));
  const document = await vscode.workspace.openNotebookDocument(fixture);
  await vscode.window.showNotebookDocument(document);
}

function postWithHost(port: number, host: string): Promise<{ statusCode: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/mcp",
        method: "POST",
        headers: {
          "host": host,
          "content-type": "application/json",
          "accept": "application/json, text/event-stream"
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    req.on("error", reject);
    req.end(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
  });
}
