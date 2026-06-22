export const DISPLAY_NAME_MAX_LENGTH = 30;
export const MESSAGE_MAX_LENGTH = 1000;

const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N} _-]+$/u;
const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;

export function validateDisplayName(value) {
  const displayName = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!displayName) {
    return { ok: false, message: "Введите имя" };
  }

  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, message: `Имя должно быть не длиннее ${DISPLAY_NAME_MAX_LENGTH} символов` };
  }

  if (!DISPLAY_NAME_PATTERN.test(displayName)) {
    return { ok: false, message: "Используйте буквы, цифры, пробел, дефис или подчёркивание" };
  }

  return { ok: true, value: displayName };
}

export function validateRoomName(value) {
  const roomName = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!roomName) {
    return { ok: false, message: "Введите имя комнаты" };
  }

  if (roomName.length > DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, message: `Имя комнаты должно быть не длиннее ${DISPLAY_NAME_MAX_LENGTH} символов` };
  }

  if (!DISPLAY_NAME_PATTERN.test(roomName)) {
    return { ok: false, message: "Используйте буквы, цифры, пробел, дефис или подчёркивание" };
  }

  return { ok: true, value: roomName };
}

export function validateMessage(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { ok: false, message: "Сообщение не может быть пустым" };
  }

  if (text.length > MESSAGE_MAX_LENGTH) {
    return { ok: false, message: `Сообщение должно быть не длиннее ${MESSAGE_MAX_LENGTH} символов` };
  }

  return { ok: true, value: text };
}

export function isValidRoomId(value) {
  return ROOM_ID_PATTERN.test(String(value ?? ""));
}

export function createRoomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  }

  return Math.random().toString(36).slice(2, 12);
}

export function createGuestName() {
  const value = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint16Array(1))[0]
    : Math.floor(Math.random() * 65535);

  return `Гость ${String((value % 9000) + 1000)}`;
}

export function formatLocalTime(timestamp) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}
