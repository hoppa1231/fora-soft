import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "/";

export function useSocketRoom({ roomId, displayName, enabled, initialMediaState }) {
  const socketRef = useRef(null);
  const [status, setStatus] = useState(enabled ? "connecting" : "idle");
  const [error, setError] = useState("");
  const [participantId, setParticipantId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [existingParticipants, setExistingParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [signals, setSignals] = useState([]);
  const [soundEffects, setSoundEffects] = useState([]);

  useEffect(() => {
    if (!enabled) return undefined;

    setStatus("connecting");
    setError("");

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit(
        "join-room",
        {
          roomId,
          displayName,
          audioEnabled: initialMediaState.audioEnabled,
          videoEnabled: initialMediaState.videoEnabled
        },
        (response) => {
          if (!response?.ok) {
            setStatus(response?.code === "ROOM_FULL" ? "room-full" : "error");
            setError(response?.message ?? "Не удалось войти в комнату");
            return;
          }

          setParticipantId(response.participantId);
          setParticipants(response.room.participants);
          setExistingParticipants(response.existingParticipants);
          setMessages(response.room.messages);
          setStatus("joined");
        }
      );
    });

    socket.on("connect_error", () => {
      setStatus("server-error");
      setError("Не удалось подключиться к серверу.");
    });

    socket.on("participants-updated", (payload) => {
      setParticipants(payload.participants);
    });

    socket.on("participant-left", ({ participant }) => {
      if (!participant) return;
      setSignals((items) => [...items, { type: "participant-left", from: participant.id }]);
    });

    socket.on("chat-message", (message) => {
      setMessages((items) => {
        if (items.some((item) => item.id === message.id)) {
          return items;
        }
        return [...items, message];
      });
    });

    socket.on("signal", (signal) => {
      setSignals((items) => [...items, signal]);
    });

    socket.on("sound-effect", (effect) => {
      setSoundEffects((items) => [...items, effect]);
    });

    return () => {
      socket.emit("leave-room", { roomId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [displayName, enabled, initialMediaState.audioEnabled, initialMediaState.videoEnabled, roomId]);

  const sendMessage = useCallback((text) => {
    socketRef.current?.emit("chat-message", { roomId, text });
  }, [roomId]);

  const sendSignal = useCallback((signal) => {
    socketRef.current?.emit("signal", { roomId, ...signal });
  }, [roomId]);

  const sendMediaState = useCallback((mediaState) => {
    socketRef.current?.emit("media-state", { roomId, ...mediaState });
  }, [roomId]);

  const sendSoundEffect = useCallback((effectId) => {
    socketRef.current?.emit("sound-effect", { roomId, effectId });
  }, [roomId]);

  const leave = useCallback(() => {
    socketRef.current?.emit("leave-room", { roomId });
    socketRef.current?.disconnect();
  }, [roomId]);

  const consumeSignal = useCallback((signal) => {
    setSignals((items) => items.filter((item) => item !== signal));
  }, []);

  const consumeSoundEffect = useCallback((effect) => {
    setSoundEffects((items) => items.filter((item) => item !== effect));
  }, []);

  return useMemo(() => ({
    status,
    error,
    participantId,
    participants,
    existingParticipants,
    messages,
    signals,
    soundEffects,
    sendMessage,
    sendSignal,
    sendMediaState,
    sendSoundEffect,
    leave,
    consumeSignal,
    consumeSoundEffect
  }), [
    status,
    error,
    participantId,
    participants,
    existingParticipants,
    messages,
    signals,
    soundEffects,
    sendMessage,
    sendSignal,
    sendMediaState,
    sendSoundEffect,
    leave,
    consumeSignal,
    consumeSoundEffect
  ]);
}
