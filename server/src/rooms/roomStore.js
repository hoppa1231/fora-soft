const MAX_PARTICIPANTS = 4;
const MAX_MESSAGES_PER_ROOM = 300;

function createSystemMessage(roomId, text) {
  return {
    id: crypto.randomUUID(),
    type: "system",
    roomId,
    senderId: null,
    senderName: null,
    text,
    createdAt: Date.now()
  };
}

function serializeParticipant(participant) {
  return {
    id: participant.id,
    displayName: participant.displayName,
    joinedAt: participant.joinedAt,
    audioEnabled: participant.audioEnabled,
    videoEnabled: participant.videoEnabled
  };
}

function serializeRoom(room) {
  return {
    id: room.id,
    name: room.name,
    participants: [...room.participants.values()].map(serializeParticipant),
    messages: [...room.messages]
  };
}

export class RoomStore {
  constructor() {
    this.rooms = new Map();
    this.socketIndex = new Map();
  }

  createOrJoinRoom({ roomId, roomName, socketId, displayName, audioEnabled = false, videoEnabled = false }) {
    let room = this.rooms.get(roomId);

    if (!room) {
      room = {
        id: roomId,
        name: roomName || roomId,
        createdAt: Date.now(),
        participants: new Map(),
        messages: []
      };
      this.rooms.set(roomId, room);
    } else if (!room.name && roomName) {
      room.name = roomName;
    }

    if (room.participants.size >= MAX_PARTICIPANTS) {
      return {
        ok: false,
        code: "ROOM_FULL",
        message: "Комната заполнена"
      };
    }

    const existingParticipants = [...room.participants.values()].map(serializeParticipant);
    const participant = {
      id: socketId,
      socketId,
      displayName,
      joinedAt: Date.now(),
      audioEnabled,
      videoEnabled
    };

    room.participants.set(socketId, participant);
    this.socketIndex.set(socketId, roomId);

    const systemMessage = createSystemMessage(roomId, `${displayName} присоединился к комнате`);
    this.#appendMessageToRoom(room, systemMessage);

    return {
      ok: true,
      room: serializeRoom(room),
      participant: serializeParticipant(participant),
      existingParticipants,
      systemMessage
    };
  }

  leaveRoomBySocket(socketId) {
    const roomId = this.socketIndex.get(socketId);

    if (!roomId) {
      return { ok: false, code: "NOT_IN_ROOM", message: "Участник не находится в комнате" };
    }

    const room = this.rooms.get(roomId);

    if (!room) {
      this.socketIndex.delete(socketId);
      return { ok: false, code: "NOT_IN_ROOM", message: "Комната не найдена" };
    }

    const participant = room.participants.get(socketId);
    room.participants.delete(socketId);
    this.socketIndex.delete(socketId);

    const systemMessage = participant
      ? createSystemMessage(roomId, `${participant.displayName} покинул комнату`)
      : null;

    if (systemMessage && room.participants.size > 0) {
      this.#appendMessageToRoom(room, systemMessage);
    }

    const deleted = room.participants.size === 0;

    if (deleted) {
      this.rooms.delete(roomId);
    }

    return {
      ok: true,
      roomId,
      participant: participant ? serializeParticipant(participant) : null,
      room: deleted ? null : serializeRoom(room),
      systemMessage: deleted ? null : systemMessage,
      deleted
    };
  }

  getRoom(roomId) {
    const room = this.rooms.get(roomId);
    return room ? serializeRoom(room) : null;
  }

  getRoomBySocket(socketId) {
    const roomId = this.socketIndex.get(socketId);
    return roomId ? this.getRoom(roomId) : null;
  }

  hasParticipant(roomId, socketId) {
    return Boolean(this.rooms.get(roomId)?.participants.has(socketId));
  }

  appendUserMessage({ roomId, senderId, text }) {
    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(senderId);

    if (!room || !participant) {
      return { ok: false, code: "NOT_IN_ROOM", message: "Участник не находится в комнате" };
    }

    const message = {
      id: crypto.randomUUID(),
      type: "user",
      roomId,
      senderId,
      senderName: participant.displayName,
      text,
      createdAt: Date.now()
    };

    this.#appendMessageToRoom(room, message);

    return { ok: true, message };
  }

  updateParticipantMedia({ roomId, socketId, audioEnabled, videoEnabled }) {
    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(socketId);

    if (!room || !participant) {
      return { ok: false, code: "NOT_IN_ROOM", message: "Участник не находится в комнате" };
    }

    participant.audioEnabled = audioEnabled;
    participant.videoEnabled = videoEnabled;

    return {
      ok: true,
      participant: serializeParticipant(participant),
      room: serializeRoom(room)
    };
  }

  #appendMessageToRoom(room, message) {
    room.messages.push(message);

    if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
      room.messages.splice(0, room.messages.length - MAX_MESSAGES_PER_ROOM);
    }
  }
}

export { MAX_PARTICIPANTS, MAX_MESSAGES_PER_ROOM };
