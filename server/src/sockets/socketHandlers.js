import { createChatMessage, joinRoom, updateMediaState, validateSignalPayload } from "../rooms/roomService.js";

function emitParticipants(io, room) {
  io.to(room.id).emit("participants-updated", {
    roomId: room.id,
    participants: room.participants
  });
}

const ALLOWED_SOUND_EFFECTS = new Set(["airhorn", "rimshot", "clap", "cricket", "trombone"]);

export function registerSocketHandlers(io, store) {
  io.on("connection", (socket) => {
    socket.on("join-room", (payload, ack) => {
      const result = joinRoom({ store, payload, socketId: socket.id });

      if (!result.ok) {
        ack?.(result);
        return;
      }

      socket.join(result.room.id);

      ack?.({
        ok: true,
        participantId: result.participant.id,
        participant: result.participant,
        existingParticipants: result.existingParticipants,
        room: result.room
      });

      socket.to(result.room.id).emit("participant-joined", {
        roomId: result.room.id,
        participant: result.participant,
        participants: result.room.participants
      });

      io.to(result.room.id).emit("chat-message", result.systemMessage);
      emitParticipants(io, result.room);
    });

    socket.on("chat-message", (payload, ack) => {
      const result = createChatMessage({ store, payload, socketId: socket.id });

      if (!result.ok) {
        ack?.(result);
        return;
      }

      io.to(result.message.roomId).emit("chat-message", result.message);
      ack?.({ ok: true, message: result.message });
    });

    socket.on("signal", (payload, ack) => {
      const result = validateSignalPayload({ store, payload, socketId: socket.id });

      if (!result.ok) {
        ack?.(result);
        return;
      }

      io.to(result.value.to).emit("signal", {
        roomId: result.value.roomId,
        from: result.value.from,
        type: result.value.type,
        payload: result.value.payload
      });

      ack?.({ ok: true });
    });

    socket.on("media-state", (payload, ack) => {
      const result = updateMediaState({ store, payload, socketId: socket.id });

      if (!result.ok) {
        ack?.(result);
        return;
      }

      emitParticipants(io, result.room);
      ack?.({ ok: true, participant: result.participant });
    });

    socket.on("sound-effect", (payload, ack) => {
      const roomId = String(payload?.roomId ?? "");
      const effectId = String(payload?.effectId ?? "");

      if (!store.hasParticipant(roomId, socket.id)) {
        ack?.({ ok: false, code: "NOT_IN_ROOM", message: "Участник не находится в комнате" });
        return;
      }

      if (!ALLOWED_SOUND_EFFECTS.has(effectId)) {
        ack?.({ ok: false, code: "VALIDATION_ERROR", message: "Некорректный звук" });
        return;
      }

      socket.to(roomId).emit("sound-effect", {
        roomId,
        effectId,
        from: socket.id,
        createdAt: Date.now()
      });
      ack?.({ ok: true });
    });

    socket.on("leave-room", (_payload, ack) => {
      const result = store.leaveRoomBySocket(socket.id);

      if (!result.ok) {
        ack?.(result);
        return;
      }

      socket.leave(result.roomId);

      if (!result.deleted && result.room) {
        socket.to(result.roomId).emit("participant-left", {
          roomId: result.roomId,
          participant: result.participant,
          participants: result.room.participants
        });

        if (result.systemMessage) {
          socket.to(result.roomId).emit("chat-message", result.systemMessage);
        }

        emitParticipants(io, result.room);
      }

      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const result = store.leaveRoomBySocket(socket.id);

      if (!result.ok || result.deleted || !result.room) {
        return;
      }

      socket.to(result.roomId).emit("participant-left", {
        roomId: result.roomId,
        participant: result.participant,
        participants: result.room.participants
      });

      if (result.systemMessage) {
        socket.to(result.roomId).emit("chat-message", result.systemMessage);
      }

      emitParticipants(io, result.room);
    });
  });
}
