export const SOUND_EFFECTS = [
  { id: "airhorn", label: "Airhorn" },
  { id: "bruh", label: "Bruh" },
  { id: "tada", label: "Ta-da" },
  { id: "boing", label: "Boing" }
];

function createContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function beep(context, { type = "sine", frequency, duration, start = 0, gain = 0.24, endFrequency = frequency }) {
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  const now = context.currentTime + start;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
  volume.gain.setValueAtTime(0.0001, now);
  volume.gain.exponentialRampToValueAtTime(gain, now + 0.018);
  volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(volume).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

export function playSoundEffect(effectId) {
  const context = createContext();
  if (!context) return;

  if (effectId === "airhorn") {
    beep(context, { type: "sawtooth", frequency: 420, endFrequency: 390, duration: 0.34, gain: 0.24 });
    beep(context, { type: "sawtooth", frequency: 520, endFrequency: 480, duration: 0.34, gain: 0.2 });
  }

  if (effectId === "bruh") {
    beep(context, { type: "triangle", frequency: 180, endFrequency: 82, duration: 0.48, gain: 0.32 });
  }

  if (effectId === "tada") {
    beep(context, { frequency: 523, duration: 0.12, gain: 0.22 });
    beep(context, { frequency: 659, duration: 0.12, start: 0.13, gain: 0.22 });
    beep(context, { frequency: 784, duration: 0.24, start: 0.26, gain: 0.26 });
  }

  if (effectId === "boing") {
    beep(context, { type: "square", frequency: 220, endFrequency: 620, duration: 0.18, gain: 0.2 });
    beep(context, { type: "sine", frequency: 620, endFrequency: 280, duration: 0.22, start: 0.18, gain: 0.26 });
  }

  window.setTimeout(() => context.close(), 900);
}
