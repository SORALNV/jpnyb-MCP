# Security Policy

## Supported Versions

Security fixes are provided for the latest released version.

## Reporting a Vulnerability

Please report vulnerabilities through GitHub Security Advisories for this repository, or open a private report if that is available for your account.

Do not include notebook contents, credentials, API keys, or private output data in public issues.

## Local MCP Server Trust Model

This extension starts a local MCP server bound to `127.0.0.1`. It validates the `Host` header and only accepts `127.0.0.1:<port>` or `localhost:<port>`.

The server is intentionally read-only, but any local process that can connect to the port may be able to read notebook source and text-like output previews. Disable `notebookMcp.includeOutputs` if notebook outputs may contain secrets or private data.
