import { useEffect, useMemo, useState } from "react";
import { LandingPage } from "../pages/LandingPage.jsx";
import { PreJoinPage } from "../pages/PreJoinPage.jsx";
import { RoomPage } from "../pages/RoomPage.jsx";

function readRoomIdFromPath() {
  const match = window.location.pathname.match(/^\/room\/([a-zA-Z0-9_-]+)$/);
  return match?.[1] ?? null;
}

export function App() {
  const [pathRoomId, setPathRoomId] = useState(readRoomIdFromPath);
  const [pendingSession, setPendingSession] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    const onPopState = () => {
      setPathRoomId(readRoomIdFromPath());
      setPendingSession(null);
      setActiveSession(null);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const route = useMemo(() => ({ roomId: pathRoomId }), [pathRoomId]);

  const prepareRoom = ({ roomId, roomName }) => {
    window.history.pushState({}, "", `/room/${roomId}`);
    setPathRoomId(roomId);
    setPendingSession({ roomId, roomName });
    setActiveSession(null);
  };

  const joinPreparedRoom = ({ displayName, mediaPreferences }) => {
    const roomId = pendingSession?.roomId ?? pathRoomId;
    if (!roomId) return;

    setActiveSession({
      roomId,
      roomName: pendingSession?.roomName,
      displayName,
      mediaPreferences
    });
  };

  const leaveRoom = () => {
    window.history.pushState({}, "", "/");
    setPathRoomId(null);
    setPendingSession(null);
    setActiveSession(null);
  };

  if (route.roomId && activeSession?.roomId === route.roomId) {
    return (
      <RoomPage
        displayName={activeSession.displayName}
        initialMediaPreferences={activeSession.mediaPreferences}
        roomId={activeSession.roomId}
        roomName={activeSession.roomName}
        onLeave={leaveRoom}
      />
    );
  }

  if (route.roomId && (pendingSession?.roomId === route.roomId || !pendingSession)) {
    return (
      <PreJoinPage
        roomId={route.roomId}
        onBack={leaveRoom}
        onJoin={joinPreparedRoom}
      />
    );
  }

  return <LandingPage onCreateRoom={prepareRoom} />;
}
