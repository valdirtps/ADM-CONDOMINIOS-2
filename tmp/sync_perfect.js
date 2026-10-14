const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");
const crypto = require("crypto");

async function getToken() {
  return new Promise((resolve, reject) => {
    const mdUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(process.env.APP_URL)}`;
    http.get(mdUrl, { headers: { "Metadata-Flavor": "Google" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode === 200) resolve(data.trim());
        else reject(new Error(`Failed to get token: ${res.statusCode} ${data}`));
      });
    }).on("error", reject);
  });
}

async function makeRequest(token, endpoint, payload) {
  const hostName = url.parse(process.env.APP_URL).hostname;
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const req = http.request({
      hostname: "localhost",
      port: 8001,
      path: endpoint,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Host": hostName,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode === 200) resolve(data);
        else reject(new Error(`Failed on ${endpoint}: ${res.statusCode} ${data}`));
      });
    });
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

function getFiles(dir, allFiles = []) {
  if (!fs.existsSync(dir)) return allFiles;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== ".git" && file !== "node_modules" && file !== ".next" && file !== "dist") {
        getFiles(fullPath, allFiles);
      }
    } else {
      if (!file.endsWith(".db") && file !== "tsconfig.tsbuildinfo") {
        allFiles.push(fullPath);
      }
    }
  }
  return allFiles;
}

async function main() {
  try {
    const srcDir = "/tmp/ControleCondominio/app/applet";
    if (!fs.existsSync(srcDir)) {
      console.error(`Source directory ${srcDir} does not exist.`);
      return;
    }

    console.log("Fetching token...");
    const token = await getToken();
    console.log("Token obtained successfully.");

    console.log("Scanning files...");
    const files = getFiles(srcDir);
    console.log(`Found ${files.length} files to sync.`);

    // 1. Create all directories first
    const dirs = new Set();
    for (const file of files) {
      const relPath = path.relative(srcDir, file);
      const dirName = path.dirname(relPath);
      if (dirName !== ".") {
        dirs.add(dirName);
      }
    }

    console.log("Creating directory structure...");
    for (const dir of Array.from(dirs).sort()) {
      const apiPath = `app/applet/${dir}`;
      console.log(`Creating directory ${apiPath}...`);
      await makeRequest(token, "/fs/mkdirall", { path: apiPath, perm: 493 });
    }

    // 2. Write files in batches of 10
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const chunk = files.slice(i, i + batchSize);
      console.log(`Syncing batch ${Math.floor(i / batchSize) + 1} / ${Math.ceil(files.length / batchSize)}...`);
      
      const payload = {
        files: {},
        hashes: {}
      };

      for (const file of chunk) {
        const relPath = path.relative(srcDir, file);
        const apiPath = `app/applet/${relPath}`;
        const contentBuf = fs.readFileSync(file);
        
        const b64 = contentBuf.toString("base64");
        const sha256 = crypto.createHash("sha256").update(contentBuf).digest("hex");

        payload.files[apiPath] = b64;
        payload.hashes[apiPath] = sha256;
      }

      await makeRequest(token, "/fs/write", payload);
    }

    console.log("SUCCESS: All files synchronized perfectly into the root workspace!");
  } catch (err) {
    console.error("Synchronization failed:", err);
  }
}

main();
