export function codexTomlSnippet(port: number): string {
  return [
    "[mcp_servers.vscode-notebook]",
    `url = "http://127.0.0.1:${port}/mcp"`,
    ""
  ].join("\n");
}

export function agentsSnippet(port: number): string {
  return [
    "## VS Code Notebook MCP",
    "",
    `A read-only notebook MCP server may be available at http://127.0.0.1:${port}/mcp when VS Code is running.`,
    "Use it to inspect the active notebook, focused cell, visible cells, recent executions, and text previews of outputs.",
    "Do not assume it can edit, save, or execute notebook cells."
  ].join("\n");
}
