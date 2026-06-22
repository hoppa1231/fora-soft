import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { RoomStore } from "./rooms/roomStore.js";
import { registerSocketHandlers } from "./sockets/socketHandlers.js";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"]
  }
});

const roomStore = new RoomStore();
registerSocketHandlers(io, roomStore);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

app.use(express.static(clientDist));
app.get("*", (_req, res, next) => {
  res.sendFile(path.join(clientDist, "index.html"), (error) => {
    if (error) next();
  });
});

server.listen(PORT, () => {
  console.log(`Video chat server listening on http://localhost:${PORT}`);
});

export { app, io, roomStore, server };
