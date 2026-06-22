import assert from "node:assert/strict";
import { test } from "node:test";
import { RoomStore } from "../src/rooms/roomStore.js";

test("creates room, limits participants and removes empty room", () => {
  const store = new RoomStore();

  for (let index = 1; index <= 4; index += 1) {
    const result = store.createOrJoinRoom({
      roomId: "room1",
      socketId: `socket-${index}`,
      displayName: `User ${index}`
    });

    assert.equal(result.ok, true);
  }

  const rejected = store.createOrJoinRoom({
    roomId: "room1",
    socketId: "socket-5",
    displayName: "User 5"
  });

  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "ROOM_FULL");

  for (let index = 1; index <= 4; index += 1) {
    store.leaveRoomBySocket(`socket-${index}`);
  }

  assert.equal(store.getRoom("room1"), null);
});

test("keeps chat history for room lifetime", () => {
  const store = new RoomStore();
  store.createOrJoinRoom({ roomId: "room2", socketId: "socket-1", displayName: "Алекс" });

  const message = store.appendUserMessage({
    roomId: "room2",
    senderId: "socket-1",
    text: "Привет"
  });

  assert.equal(message.ok, true);
  assert.equal(store.getRoom("room2").messages.at(-1).text, "Привет");
});
