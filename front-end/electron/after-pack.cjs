const { spawnSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const productName = context.packager.appInfo.productFilename;
  const plistPath = path.join(context.appOutDir, `${productName}.app`, "Contents", "Info.plist");

  setPlistValue(plistPath, "NSAppTransportSecurity:NSAllowsArbitraryLoads", "false");
};

function setPlistValue(plistPath, keyPath, value) {
  const result = spawnSync("/usr/libexec/PlistBuddy", [
    "-c",
    `Set :${keyPath} ${value}`,
    plistPath,
  ], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to update ${keyPath}: ${result.stderr || result.stdout}`);
  }
}
