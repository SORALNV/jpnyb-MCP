# Notebook MCP

Notebook MCP は、VS Code で開いている現在の notebook を Codex などの MCP client から読み取るための read-only 拡張です。

v1 は読み取り専用です。cell の編集、保存、実行、kernel 操作は行いません。

## できること

- 現在アクティブな notebook の path、種類、cell 数、選択範囲、表示範囲を取得
- focused cell の source、実行概要、出力メタデータを取得
- 表示中の cell 一覧を取得
- 最後に実行された cell と直近の実行履歴を取得
- 指定 cell の出力を preview として取得

## MCP endpoint

既定では VS Code 起動後に次の endpoint が立ち上がります。

```text
http://127.0.0.1:47321/mcp
```

サーバーは `127.0.0.1` のみに bind します。`/mcp` 以外の path は 404 になります。

## インストール

通常の VS Code 拡張として使う場合は、VSIX を作成してインストールします。

```bash
npm install
npm run vsix
code --install-extension vscode-notebook-mcp-0.1.0.vsix --force
```

アンインストールする場合:

```bash
npm run vsix:uninstall
```

VS Code の Extensions view から入れる場合は、`...` メニューの `Install from VSIX...` で `vscode-notebook-mcp-0.1.0.vsix` を選択してください。

## Codex 設定例

VS Code のコマンドパレットから `Notebook MCP: Copy Codex Config` を実行すると、現在の port を反映した TOML をコピーできます。

```toml
[mcp_servers.vscode-notebook]
url = "http://127.0.0.1:47321/mcp"
```

AGENTS.md に説明を追加したい場合は `Notebook MCP: Copy AGENTS.md Snippet` を使ってください。

## コマンド

- `Notebook MCP: Start Server`
- `Notebook MCP: Stop Server`
- `Notebook MCP: Show Current Context`
- `Notebook MCP: Copy Codex Config`
- `Notebook MCP: Copy AGENTS.md Snippet`

## 設定

| 設定 | 既定値 | 説明 |
|---|---:|---|
| `notebookMcp.enabled` | `true` | VS Code 起動時に MCP server を開始します。 |
| `notebookMcp.port` | `47321` | local MCP server の port です。 |
| `notebookMcp.maxCharsPerCell` | `4000` | cell source と履歴 source の最大文字数です。 |
| `notebookMcp.maxOutputChars` | `2000` | text-like output item の最大 preview 文字数です。 |
| `notebookMcp.includeOutputs` | `true` | notebook output の text preview を返します。 |
| `notebookMcp.readOnly` | `true` | v1 では情報用です。拡張は read-only tool のみ登録します。 |

`includeOutputs=false` にすると、出力本文は返しません。`get_cell_outputs` は `outputs_disabled_by_setting` を返します。

## セキュリティ注意

この拡張は認証なしの local MCP server です。`127.0.0.1` のみに bind し、Host header も `127.0.0.1:<port>` または `localhost:<port>` に制限しますが、同じマシン上の別プロセスは接続できる可能性があります。

notebook の source や output には API key、token、個人情報、private な dataframe が含まれることがあります。必要に応じて `notebookMcp.includeOutputs=false` にしてください。

画像や binary output の中身は返しません。text-like MIME type のみ UTF-8 text preview として返し、それ以外は MIME type と byte size だけを返します。

## MCP tools

- `get_current_notebook_context`
- `get_focused_cell`
- `get_visible_cells`
- `get_last_executed_cell`
- `get_recent_execution_history`
- `get_cell_outputs`

すべての tool は JSON-safe な object を返します。active notebook がない場合なども throw ではなく、`{ "ok": false, "reason": "..." }` 形式で返します。

## 開発

```bash
npm install
npm run compile
npm run test:unit
npm run package
```

VS Code integration test は次で実行します。

```bash
npm run test:integration
```

実 kernel の実行イベントは環境差が大きいため、手動確認も行ってください。

1. VS Code で `.ipynb` を開く
2. code cell を実行する
3. `get_last_executed_cell` と `get_recent_execution_history` が更新されることを確認する
4. Codex に TOML 設定を追加し、live notebook に問い合わせる

## 配布

配布前の確認:

```bash
npm run check
npm run test:integration
npm run publish:dry-run
```

GitHub Release 用の VSIX を作る場合:

```bash
npm run vsix
```

Marketplace に公開する場合:

1. Visual Studio Marketplace で publisher `soralnv` を作成する
2. Personal Access Token を用意する
3. ローカルから公開する場合は `VSCE_PAT` を設定して実行する

```bash
VSCE_PAT=... npm run publish:marketplace
```

GitHub Actions では、`VSCE_PAT` secret が設定されている場合だけ Marketplace publish を実行します。タグ `v0.1.0` のような `v*.*.*` を push すると VSIX を GitHub Release asset として添付します。
