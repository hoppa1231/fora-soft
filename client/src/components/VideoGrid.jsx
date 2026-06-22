import { ParticipantTile } from "./ParticipantTile.jsx";

export function VideoGrid({ participants, localStream, remoteStreams }) {
  return (
    <div className={`video-grid video-grid--count-${Math.min(participants.length, 4)}`}>
      {participants.slice(0, 4).map((participant) => (
        <ParticipantTile
          key={participant.id}
          participant={participant}
          stream={participant.isLocal ? localStream : remoteStreams[participant.id]}
        />
      ))}
    </div>
  );
}
