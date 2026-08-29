import * as vscode from "vscode";

export async function configurePrettier() {
  try {
    const config = vscode.workspace.getConfiguration();
    // Tell Prettier extension to enable formatting for GamingTS
    await config.update(
      "prettier.documentSelectors",
      ["**/*.gts"],
      vscode.ConfigurationTarget.Global,
    );
    // Set Prettier as default formatter for .tsrx files
    await config.update(
      "[GamingTS]",
      {
        "editor.defaultFormatter": "esbenp.prettier-vscode",
      },
      vscode.ConfigurationTarget.Global,
    );

    console.log("[GamingTS] Prettier configuration updated for GamingTS files");
  } catch (error) {
    console.error("Failed to configure Prettier:", error);
  }
}
