let audio: AudioContext | null = null;
export function prepareAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
  } catch {
    /* Sound is optional when a browser does not support Web Audio. */
  }
}
export function playSound(kind: 'click' | 'correct' | 'error' | 'complete') {
  if (!audio || audio.state !== 'running') return;
  const tones =
    kind === 'complete'
      ? [523, 659, 784]
      : [kind === 'error' ? 220 : kind === 'correct' ? 660 : 440];
  tones.forEach((frequency, i) => {
    const oscillator = audio!.createOscillator(),
      gain = audio!.createGain();
    const start = audio!.currentTime + i * 0.11;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.055, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
    oscillator.connect(gain);
    gain.connect(audio!.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.11);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  });
}
