export const DISPLAY_NAME_MAX_LENGTH = 30;
export const MESSAGE_MAX_LENGTH = 1000;

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N} _-]+$/u;

export function normalizeDisplayName(value) {
  const displayName = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!displayName) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Введите имя" };
  }

  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: `Имя должно быть не длиннее ${DISPLAY_NAME_MAX_LENGTH} символов`
    };
  }

  if (!DISPLAY_NAME_PATTERN.test(displayName)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Имя может содержать буквы, цифры, пробел, дефис и подчёркивание"
    };
  }

  return { ok: true, value: displayName };
}

export function normalizeRoomId(value) {
  const roomId = String(value ?? "").trim();

  if (!ROOM_ID_PATTERN.test(roomId)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Некорректный идентификатор комнаты"
    };
  }

  return { ok: true, value: roomId };
}

export function normalizeChatMessage(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Сообщение не может быть пустым"
    };
  }

  if (text.length > MESSAGE_MAX_LENGTH) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: `Сообщение должно быть не длиннее ${MESSAGE_MAX_LENGTH} символов`
    };
  }

  return { ok: true, value: text };
}

export function asBoolean(value) {
  return value === true;
}
