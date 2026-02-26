/**
 * Static self-test: codebase uses centralized client-mode visibility helper
 * and still hides the client switcher in client mode.
 */
import fs from "node:fs";
import path from "node:path";

function mustContain(file, needles) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${file}`);
  const s = fs.readFileSync(p, "utf8");
  for (const n of needles) {
    if (!s.includes(n)) throw new Error(`Expected ${file} to contain: ${n}`);
  }
}

mustContain("src/platform/mode.ts", ["getUIMode", "isClientUI"]);

// Helper: single source of truth for visible CRM top tabs in client mode.
mustContain("src/utils/crmTopTabsVisibility.ts", ["customers-home", "getVisibleCrmTopTabs"]);

// Nav: App.tsx uses helper for visible tabs and tab resolution.
mustContain("src/App.tsx", ["getVisibleCrmTopTabs", "resolveClientModeTab"]);

// Nav: CrmTopTabs uses helper for visible tabs.
mustContain("src/components/nav/CrmTopTabs.tsx", ["getVisibleCrmTopTabs"]);

// Client switcher: OnboardingHomePage still hides CustomerSelector in client mode.
mustContain("src/tabs/onboarding/OnboardingHomePage.tsx", ["isClientUI", "CustomerSelector"]);

console.log("✅ client mode UI guard self-test passed");
