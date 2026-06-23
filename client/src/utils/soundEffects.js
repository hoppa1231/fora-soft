export const SOUND_EFFECTS = [
  { id: "airhorn", label: "Гудок", src: "/sounds/airhorn.wav" },
  { id: "rimshot", label: "Барабаны", src: "/sounds/rimshot.mp3" },
  { id: "clap", label: "Аплодисменты", src: "/sounds/clap.mp3" },
  { id: "cricket", label: "Сверчок", src: "/sounds/cricket.wav" },
  { id: "trombone", label: "Тромбон", src: "/sounds/trombone.mp3" }
];

export function playSoundEffect(effectId) {
  const effect = SOUND_EFFECTS.find((item) => item.id === effectId);
  if (!effect) return;

  const audio = new Audio(effect.src);
  audio.volume = 1;
  audio.play().catch(() => {});
}
