const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    }).on("error", reject);
  });
}

(async () => {
  const FRONTEND = process.env.PROD_FRONTEND || "https://odcrm.bidlow.co.uk";
  const BACKEND  = process.env.PROD_BACKEND  || "https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net";

  const targets = [
    { name: "frontend __build.json", url: `${FRONTEND}/__build.json` },
    { name: "backend /api/_build",   url: `${BACKEND}/api/_build` }
  ];

  let failed = false;

  for (const t of targets) {
    const r = await get(t.url);
    console.log(`\n== ${t.name} ==\n${t.url}\nHTTP ${r.status}\n${r.data}`);
    if (r.status < 200 || r.status >= 300) failed = true;
  }

  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
