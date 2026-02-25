/**
 * Production deploy verification.
 * Mode A (backend deploy): EXPECT_BACKEND_SHA set → assert backend /api/_build sha === EXPECT_BACKEND_SHA (with retries).
 * Mode B (drift check): compare frontend __build.json sha to backend /api/_build sha; exit 1 on mismatch.
 * No new dependencies; safe for CI (no interactive).
 *
 * Env: PROD_FRONTEND, PROD_BACKEND (optional); EXPECT_BACKEND_SHA (optional, enables Mode A).
 */

const https = require("https");
const { execSync } = require("child_process");

const RETRY_COUNT = 60;
const RETRY_DELAY_MS = 10000;

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      })
      .on("error", reject);
  });
}

function getCurrentGitSha() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return process.env.GITHUB_SHA || "unknown";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mode A: verify backend serves expected SHA (with retries)
async function modeA(expectedSha, backendUrl) {
  const buildUrl = `${backendUrl}/api/_build`;
  console.log("Mode A: Backend deploy verification");
  console.log("  EXPECT_BACKEND_SHA:", expectedSha);
  console.log("  Backend URL:      ", buildUrl);
  console.log("  Retries:          ", RETRY_COUNT, "attempts,", RETRY_DELAY_MS / 1000, "s apart");
  console.log("");

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const r = await get(buildUrl);
      if (r.status < 200 || r.status >= 300) {
        console.log(`  Attempt ${attempt}/${RETRY_COUNT}: HTTP ${r.status} (expected SHA: ${expectedSha})`);
        if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS);
        continue;
      }
      const json = JSON.parse(r.data);
      const observedSha = json.sha || json.GIT_SHA || null;
      console.log(`  Attempt ${attempt}/${RETRY_COUNT}: observed SHA = ${observedSha || "(missing)"}, expected SHA = ${expectedSha}`);
      if (observedSha === expectedSha) {
        console.log("");
        console.log("✅ Backend is serving the expected SHA:", expectedSha);
        process.exit(0);
      }
      if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS);
    } catch (e) {
      console.log(`  Attempt ${attempt}/${RETRY_COUNT}: Error -`, e.message || e, `(expected SHA: ${expectedSha})`);
      if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS);
    }
  }

  console.error("");
  console.error("❌ Backend deploy verification FAILED: backend did not serve expected SHA within retry window.");
  console.error("   Expected SHA:", expectedSha);
  console.error("   Run backend workflow again or check Azure App Service logs.");
  process.exit(1);
}

// Mode B: compare frontend and backend SHAs (drift check)
async function modeB() {
  const FRONTEND =
    process.env.PROD_FRONTEND || "https://odcrm.bidlow.co.uk";
  const BACKEND =
    process.env.PROD_BACKEND ||
    "https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net";

  const currentSha = getCurrentGitSha();
  const inCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS;
  if (!inCI) {
    console.log("CURRENT GIT SHA (this repo):", currentSha);
    console.log("");
  }

  const frontendUrl = `${FRONTEND}/__build.json`;
  const backendUrl = `${BACKEND}/api/_build`;

  let frontendSha = null;
  let backendSha = null;
  let failed = false;

  console.log("FRONTEND URL:", frontendUrl);
  const frontendRes = await get(frontendUrl);
  console.log("  HTTP", frontendRes.status);
  if (frontendRes.status >= 200 && frontendRes.status < 300) {
    try {
      const json = JSON.parse(frontendRes.data);
      frontendSha = json.sha || json.GIT_SHA || null;
      console.log("  FRONTEND SHA:", frontendSha || "(missing in response)");
    } catch (e) {
      console.log("  FRONTEND response (raw):", frontendRes.data.slice(0, 200));
      failed = true;
    }
  } else {
    console.log("  FRONTEND response:", frontendRes.data.slice(0, 200));
    failed = true;
  }
  console.log("");

  console.log("BACKEND URL:", backendUrl);
  const backendRes = await get(backendUrl);
  console.log("  HTTP", backendRes.status);
  if (backendRes.status >= 200 && backendRes.status < 300) {
    try {
      const json = JSON.parse(backendRes.data);
      backendSha = json.sha || json.GIT_SHA || null;
      console.log("  BACKEND SHA:", backendSha || "(missing in response)");
    } catch (e) {
      console.log("  BACKEND response (raw):", backendRes.data.slice(0, 200));
      failed = true;
    }
  } else {
    console.log("  BACKEND response:", backendRes.data.slice(0, 200));
    failed = true;
  }

  if (failed) {
    console.error("\n❌ One or more build endpoints failed or returned invalid JSON.");
    process.exit(1);
  }

  if (frontendSha && backendSha && frontendSha !== backendSha) {
    console.error("\n❌ SHA MISMATCH — frontend and backend are not on the same deploy.");
    console.error("   FRONTEND SHA:", frontendSha);
    console.error("   BACKEND SHA: ", backendSha);
    console.error("");
    console.error("   Ensure both frontend and backend workflows have completed for the same commit.");
    console.error("   Run backend deploy (or workflow_dispatch) if backend is behind.");
    process.exit(1);
  }

  if (!frontendSha || !backendSha) {
    console.error("\n❌ Could not read SHA from one or both build endpoints.");
    process.exit(1);
  }

  console.log("\n✅ FRONTEND and BACKEND SHAs match:", frontendSha);
  process.exit(0);
}

(async () => {
  const expectedBackendSha = process.env.EXPECT_BACKEND_SHA;
  if (expectedBackendSha) {
    const backend =
      process.env.PROD_BACKEND ||
      "https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net";
    await modeA(expectedBackendSha.trim(), backend.replace(/\/$/, ""));
    return;
  }
  await modeB();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
