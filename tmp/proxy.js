const http = require("http");

const server = http.createServer((clientReq, clientRes) => {
  let body = "";
  clientReq.on("data", (chunk) => body += chunk);
  clientReq.on("end", () => {
    console.log(`\n--- REQUEST ---`);
    console.log(`${clientReq.method} ${clientReq.url}`);
    console.log(`Headers:`, clientReq.headers);
    console.log(`Body:`, body);

    const proxyReq = http.request({
      hostname: "localhost",
      port: 8001,
      path: clientReq.url,
      method: clientReq.method,
      headers: clientReq.headers
    }, (proxyRes) => {
      let proxyBody = "";
      proxyRes.on("data", (chunk) => proxyBody += chunk);
      proxyRes.on("end", () => {
        console.log(`--- RESPONSE ---`);
        console.log(`Status: ${proxyRes.statusCode}`);
        console.log(`Headers:`, proxyRes.headers);
        console.log(`Body:`, proxyBody);

        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        clientRes.end(proxyBody);
      });
    });

    proxyReq.on("error", (err) => {
      console.error("Proxy Error:", err);
      clientRes.writeHead(500, { "Content-Type": "text/plain" });
      clientRes.end("Proxy error: " + err.message);
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(8000, () => {
  console.log("Proxy listening on port 8000, forwarding to 8001");
});
