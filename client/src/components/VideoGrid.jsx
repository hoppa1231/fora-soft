import { ParticipantTile } from "./ParticipantTile.jsx";
import { useEffect, useState } from "react";

export function VideoGrid({ participants, localStream, remoteStreams }) {
  const [volumes, setVolumes] = useState({});

  useEffect(() => {
    const participantIds = new Set(participants.map((participant) => participant.id));
    setVolumes((items) => Object.fromEntries(Object.entries(items).filter(([id]) => participantIds.has(id))));
  }, [participants]);

  return (
    <div className={`video-grid video-grid--count-${Math.min(participants.length, 4)}`}>
      {participants.slice(0, 4).map((participant) => {
        const volume = participant.isLocal ? 0 : volumes[participant.id] ?? 100;

        return (
          <ParticipantTile
            key={participant.id}
            onVolumeChange={participant.isLocal ? undefined : (nextVolume) => {
              setVolumes((items) => ({ ...items, [participant.id]: nextVolume }));
            }}
            participant={participant}
            stream={participant.isLocal ? localStream : remoteStreams[participant.id]}
            volume={volume}
          />
        );
      })}
    </div>
  );
}
