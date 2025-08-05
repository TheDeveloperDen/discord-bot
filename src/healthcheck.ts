export function startHealthCheck() {
  Bun.serve({
    routes: {
      "/health": new Response("OK"),
    },
  });
  console.log("Health check server started on /health");
}
