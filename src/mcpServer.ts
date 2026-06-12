import { randomUUID } from "node:crypto";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ConfigReader, NotebookStateReader } from "./types";
import { createMcpToolCallback, toolDefinitions } from "./tools";

type McpSession = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
};

export class PortInUseError extends Error {
  constructor(readonly port: number) {
    super(`Port ${port} is already in use`);
  }
}

export class NotebookMcpServer {
  private httpServer: http.Server | undefined;
  private port: number | undefined;
  private readonly sessions = new Map<string, McpSession>();

  constructor(
    private readonly state: NotebookStateReader,
    private readonly configReader: ConfigReader
  ) {}

  get isRunning(): boolean {
    return this.httpServer !== undefined;
  }

  get currentPort(): number | undefined {
    return this.port;
  }

  async start(port: number): Promise<void> {
    if (this.httpServer && this.port === port) {
      return;
    }

    await this.stop();

    const server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off("listening", onListening);
        if (error.code === "EADDRINUSE") {
          reject(new PortInUseError(port));
          return;
        }
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    });

    this.httpServer = server;
    const address = server.address() as AddressInfo;
    this.port = address.port;
  }

  async stop(): Promise<void> {
    const server = this.httpServer;
    this.httpServer = undefined;
    this.port = undefined;

    await Promise.all(Array.from(this.sessions.keys()).map((sessionId) => this.closeSession(sessionId)));

    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      if (!this.isMcpPath(req)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }

      if (!this.isAllowedHost(req.headers.host)) {
        sendJson(res, 403, { error: "forbidden_host" });
        return;
      }

      const sessionId = getHeader(req, "mcp-session-id");
      if (sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
          sendJson(res, 404, { error: "unknown_session" });
          return;
        }

        const parsedBody = req.method === "POST" ? await readJsonBody(req) : undefined;
        await session.transport.handleRequest(req, res, parsedBody);
        return;
      }

      if (req.method !== "POST") {
        sendJson(res, 405, {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed." },
          id: null
        });
        return;
      }

      const parsedBody = await readJsonBody(req);
      if (!isInitializeRequest(parsedBody)) {
        sendJson(res, 400, {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Missing MCP session ID. Initialize first." },
          id: getRequestId(parsedBody)
        });
        return;
      }

      const session = this.createSession();
      await session.server.connect(session.transport);
      await session.transport.handleRequest(req, res, parsedBody);
    } catch (error) {
      if (!res.headersSent) {
        sendJson(res, 500, {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal server error"
          },
          id: null
        });
      } else {
        res.end();
      }
    }
  }

  private createSession(): McpSession {
    let sessionIdForClose: string | undefined;
    const session: McpSession = {
      server: createSdkServer(this.state, this.configReader),
      transport: new StreamableHTTPServerTransport({
        enableJsonResponse: true,
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          sessionIdForClose = sessionId;
          this.sessions.set(sessionId, session);
        },
        onsessionclosed: async (sessionId) => {
          await this.closeSession(sessionId);
        }
      })
    };

    session.transport.onclose = () => {
      if (sessionIdForClose) {
        this.sessions.delete(sessionIdForClose);
      }
      void session.server.close();
    };

    return session;
  }

  private async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.sessions.delete(sessionId);
    await Promise.allSettled([session.transport.close(), session.server.close()]);
  }

  private isMcpPath(req: http.IncomingMessage): boolean {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    return url.pathname === "/mcp";
  }

  private isAllowedHost(host: string | undefined): boolean {
    if (!host || !this.port) {
      return false;
    }

    return host.toLowerCase() === `127.0.0.1:${this.port}` || host.toLowerCase() === `localhost:${this.port}`;
  }
}

function createSdkServer(state: NotebookStateReader, configReader: ConfigReader): McpServer {
  const server = new McpServer({
    name: "vscode-notebook-mcp",
    version: "0.1.0"
  });

  const ctx = { state, config: configReader };
  for (const definition of toolDefinitions) {
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema
      },
      createMcpToolCallback(definition, ctx)
    );
  }

  return server;
}

function getHeader(req: http.IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > 10 * 1024 * 1024) {
      throw new Error("Request body is too large");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isInitializeRequest(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some(isInitializeRequest);
  }

  return typeof body === "object" && body !== null && (body as { method?: unknown }).method === "initialize";
}

function getRequestId(body: unknown): unknown {
  if (Array.isArray(body)) {
    return null;
  }

  if (typeof body === "object" && body !== null && "id" in body) {
    return (body as { id?: unknown }).id ?? null;
  }

  return null;
}

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(body));
}
