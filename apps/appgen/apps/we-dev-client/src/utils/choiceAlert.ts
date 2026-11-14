import { toast } from 'react-toastify';

let audio: AudioContext | null = null;

/** Deux notes brèves, synthétisées (aucun fichier à charger). Silencieux si le navigateur bloque l'audio. */
function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    void audio.resume();
    const start = audio.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      const at = start + i * 0.16;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      osc.connect(gain).connect(audio!.destination);
      osc.start(at);
      osc.stop(at + 0.3);
    });
  } catch {
    /* le son est un plus */
  }
}

/** À appeler après un geste de l'utilisateur (envoi d'un message) : demande l'autorisation des notifications. */
export function primeChoiceNotifications() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
    // Débloque l'audio, que les navigateurs n'autorisent qu'après un geste.
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audio ??= new Ctx();
      void audio.resume();
    }
  } catch {
    /* ignoré */
  }
}

/**
 * Un choix attend l'utilisateur : un son, puis une notification du navigateur s'il n'est pas sur la page,
 * ou un toast s'il y est.
 */
export function alertChoicePending(title: string, body: string) {
  chime();
  const away = document.visibilityState !== 'visible' || !document.hasFocus();
  if (away && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, { body, tag: 'idem-choice', icon: '/favicon.ico' });
      n.onclick = () => {
        window.focus();
        n.close();
      };
      return;
    } catch {
      /* repli : le toast ci-dessous */
    }
  }
  toast.info(`${title} — ${body}`, { toastId: 'idem-choice', autoClose: 8000 });
}
