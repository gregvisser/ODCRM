/**
 * Static self-test: codebase references isClientUI() in the files that
 * hide the Clients nav entry and the client switcher in client mode.
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

// Nav: App.tsx defines/renders top-level tabs (including Clients).
mustContain("src/App.tsx", ["isClientUI", "customers-home"]);

// Nav: CrmTopTabs also renders top-level tabs (sidebar).
mustContain("src/components/nav/CrmTopTabs.tsx", ["isClientUI", "customers-home"]);

// Client switcher: OnboardingHomePage renders CustomerSelector (client switcher).
mustContain("src/tabs/onboarding/OnboardingHomePage.tsx", ["isClientUI", "CustomerSelector"]);

console.log("✅ client mode UI guard self-test passed");
