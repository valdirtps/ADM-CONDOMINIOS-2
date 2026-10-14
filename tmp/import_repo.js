const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");

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

async function writeFile(token, relPath, content) {
  const hostName = url.parse(process.env.APP_URL).hostname;
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ relative_path: relPath, content: content });
    const req = http.request({
      hostname: "localhost",
      port: 8000,
      path: "/fs/write",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Host": hostName,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode === 200) resolve();
        else reject(new Error(`Failed to write file ${relPath}: ${res.statusCode} ${data}`));
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function getFiles(dir, allFiles = []) {
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
    const srcDir = "/tmp/ControleCondominio";
    if (!fs.existsSync(srcDir)) {
      console.error(`Source directory ${srcDir} does not exist.`);
      return;
    }

    console.log("Fetching token...");
    const token = await getToken();
    console.log("Token obtained successfully.");

    console.log("Scanning files...");
    const files = getFiles(srcDir);
    console.log(`Found ${files.length} files to import.`);

    for (let i = 0; i < files.length; i++) {
      const fullPath = files[i];
      const relPath = path.relative(srcDir, fullPath);
      console.log(`[${i + 1}/${files.length}] Writing ${relPath}...`);
      const content = fs.readFileSync(fullPath, "utf8");
      
      let attempts = 3;
      while (attempts > 0) {
        try {
          await writeFile(token, relPath, content);
          break;
        } catch (err) {
          attempts--;
          console.error(`Error writing ${relPath}, attempts remaining: ${attempts}. Error: ${err.message}`);
          if (attempts === 0) throw err;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    console.log("All files imported successfully into the persistent workspace!");
  } catch (err) {
    console.error("Import failed:", err);
  }
}

main();
