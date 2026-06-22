import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";
import { RoomStore } from "../src/rooms/roomStore.js";
import { registerSocketHandlers } from "../src/sockets/socketHandlers.js";

let httpServer;
let ioServer;
let baseUrl;

function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, resolve);
  });
}

function waitFor(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

function createSocket() {
  return createClient(baseUrl, {
    transports: ["websocket"],
    forceNew: true
  });
}

before(async () => {
  httpServer = http.createServer();
  ioServer = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });
  registerSocketHandlers(ioServer, new RoomStore());

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://localhost:${address.port}`;
});

after(async () => {
  await ioServer.close();
  await new Promise((resolve) => httpServer.close(resolve));
});

test("joins room, delivers chat history and rejects fifth participant", async () => {
  const sockets = [createSocket(), createSocket(), createSocket(), createSocket(), createSocket()];
  await Promise.all(sockets.map((socket) => waitFor(socket, "connect")));

  for (let index = 0; index < 4; index += 1) {
    const response = await emitAck(sockets[index], "join-room", {
      roomId: "test-room",
      displayName: `User ${index + 1}`
    });

    assert.equal(response.ok, true);
  }

  const messageResponse = await emitAck(sockets[0], "chat-message", {
    roomId: "test-room",
    text: "hello"
  });
  assert.equal(messageResponse.ok, true);

  const rejected = await emitAck(sockets[4], "join-room", {
    roomId: "test-room",
    displayName: "User 5"
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "ROOM_FULL");

  sockets.forEach((socket) => socket.disconnect());
});

test("routes signaling only to target participant", async () => {
  const first = createSocket();
  const second = createSocket();
  await Promise.all([waitFor(first, "connect"), waitFor(second, "connect")]);

  const firstJoin = await emitAck(first, "join-room", {
    roomId: "signal-room",
    displayName: "First"
  });
  const secondJoin = await emitAck(second, "join-room", {
    roomId: "signal-room",
    displayName: "Second"
  });

  const incomingSignal = waitFor(first, "signal");
  const response = await emitAck(second, "signal", {
    roomId: "signal-room",
    to: firstJoin.participantId,
    type: "offer",
    payload: { type: "offer", sdp: "fake" }
  });

  assert.equal(response.ok, true);
  const signal = await incomingSignal;
  assert.equal(signal.from, secondJoin.participantId);
  assert.equal(signal.type, "offer");

  first.disconnect();
  second.disconnect();
});
