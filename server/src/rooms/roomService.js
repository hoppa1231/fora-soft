import { asBoolean, normalizeChatMessage, normalizeDisplayName, normalizeRoomId, normalizeRoomName } from "../validation/sanitize.js";

export function joinRoom({ store, payload, socketId }) {
  const roomIdResult = normalizeRoomId(payload?.roomId);
  if (!roomIdResult.ok) return roomIdResult;

  const displayNameResult = normalizeDisplayName(payload?.displayName);
  if (!displayNameResult.ok) return displayNameResult;

  const roomNameResult = normalizeRoomName(payload?.roomName);
  if (!roomNameResult.ok) return roomNameResult;

  return store.createOrJoinRoom({
    roomId: roomIdResult.value,
    roomName: roomNameResult.value,
    socketId,
    displayName: displayNameResult.value,
    audioEnabled: asBoolean(payload?.audioEnabled),
    videoEnabled: asBoolean(payload?.videoEnabled)
  });
}

export function createChatMessage({ store, payload, socketId }) {
  const roomIdResult = normalizeRoomId(payload?.roomId);
  if (!roomIdResult.ok) return roomIdResult;

  const textResult = normalizeChatMessage(payload?.text);
  if (!textResult.ok) return textResult;

  return store.appendUserMessage({
    roomId: roomIdResult.value,
    senderId: socketId,
    text: textResult.value
  });
}

export function updateMediaState({ store, payload, socketId }) {
  const roomIdResult = normalizeRoomId(payload?.roomId);
  if (!roomIdResult.ok) return roomIdResult;

  return store.updateParticipantMedia({
    roomId: roomIdResult.value,
    socketId,
    audioEnabled: asBoolean(payload?.audioEnabled),
    videoEnabled: asBoolean(payload?.videoEnabled)
  });
}

export function validateSignalPayload({ store, payload, socketId }) {
  const roomIdResult = normalizeRoomId(payload?.roomId);
  if (!roomIdResult.ok) return roomIdResult;

  const roomId = roomIdResult.value;
  const to = String(payload?.to ?? "");
  const type = String(payload?.type ?? "");

  if (!store.hasParticipant(roomId, socketId)) {
    return { ok: false, code: "NOT_IN_ROOM", message: "Участник не находится в комнате" };
  }

  if (!store.hasParticipant(roomId, to)) {
    return { ok: false, code: "TARGET_NOT_FOUND", message: "Адресат не найден" };
  }

  if (!["offer", "answer", "ice-candidate"].includes(type)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Некорректный тип signaling-события" };
  }

  return {
    ok: true,
    value: {
      roomId,
      from: socketId,
      to,
      type,
      payload: payload?.payload ?? null
    }
  };
}
