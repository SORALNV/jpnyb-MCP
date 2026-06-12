import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  delete process.env.ELECTRON_RUN_AS_NODE;

  const extensionDevelopmentPath = path.resolve(__dirname, "../../");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index");
  const testWorkspace = path.resolve(__dirname, "../../src/test/fixtures");

  await runTests({
    version: "1.100.0",
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [`--folder-uri=${pathToFileURL(testWorkspace).toString()}`]
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
