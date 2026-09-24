// Client-safe emoji data for the picker and :shortcode: autocomplete.
export const EMOJI_GROUPS = [
  ['Smileys', '😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 😉 😍 🥰 😘 😎 🤩 🥳 😇 🤔 🤨 😐 😴 😮 😯 😲 😳 🥺 😢 😭 😤 😡 🤯 😱 🤗 🫡 🤫 🙄 😬 🤐 🥴 😷 🤒 🤓 🧐'],
  ['Hands', '👍 👎 👏 🙌 🙏 🤝 👋 ✌️ 🤞 🤟 🤘 👌 🫶 💪 ✍️ 👀 🫵 ☝️ 👉 👈'],
  ['Hearts', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❤️‍🔥 💖 💯 ✨ ⭐ 🌟 💫 🔥 ⚡ 💥'],
  ['Celebrate', '🎉 🎊 🥂 🍾 🎂 🎁 🎈 🏆 🥇 🏅 🎯 🚀 🙌 👑 💎 🌈'],
  ['Work', '✅ ☑️ ❌ ⚠️ 📌 📎 📝 📊 📈 📉 💡 🔧 🛠️ 💻 📱 📧 📅 ⏰ 🔔 🔒 🔑 🧠 ☕ 🍕'],
  ['Nature', '🌞 🌙 ☁️ 🌧️ ❄️ 🌊 🌴 🌸 🌻 🍀 🐶 🐱 🦄 🐝 🦋 🐢'],
];

export const SHORTCODES = {
  smile: '😄', grin: '😁', joy: '😂', rofl: '🤣', wink: '😉', heart_eyes: '😍', cool: '😎', sunglasses: '😎', party: '🥳',
  thinking: '🤔', sleep: '😴', cry: '😢', sob: '😭', angry: '😡', mindblown: '🤯', scream: '😱', hug: '🤗', salute: '🫡',
  eyeroll: '🙄', shh: '🤫', nerd: '🤓', thumbsup: '👍', '+1': '👍', thumbsdown: '👎', '-1': '👎', clap: '👏', raised_hands: '🙌',
  pray: '🙏', thanks: '🙏', handshake: '🤝', wave: '👋', ok: '👌', muscle: '💪', eyes: '👀', point_right: '👉',
  heart: '❤️', love: '❤️', broken_heart: '💔', 100: '💯', sparkles: '✨', star: '⭐', fire: '🔥', zap: '⚡', boom: '💥',
  tada: '🎉', confetti: '🎊', cheers: '🥂', champagne: '🍾', cake: '🎂', birthday: '🎂', gift: '🎁', balloon: '🎈',
  trophy: '🏆', medal: '🥇', target: '🎯', rocket: '🚀', crown: '👑', gem: '💎', rainbow: '🌈', check: '✅', done: '✅',
  x: '❌', warning: '⚠️', pin: '📌', memo: '📝', chart: '📊', up: '📈', down: '📉', bulb: '💡', idea: '💡', wrench: '🔧',
  laptop: '💻', phone: '📱', email: '📧', calendar: '📅', alarm: '⏰', bell: '🔔', lock: '🔒', key: '🔑', brain: '🧠',
  coffee: '☕', pizza: '🍕', sun: '🌞', moon: '🌙', snow: '❄️', wave_water: '🌊', palm: '🌴', dog: '🐶', cat: '🐱',
  unicorn: '🦄', bee: '🐝', butterfly: '🦋', turtle: '🐢',
};

/** Up to `limit` shortcode suggestions for a partial name, e.g. "ta" → [["tada","🎉"], …]. */
export function suggestShortcodes(partial, limit = 6) {
  const p = partial.toLowerCase();
  const starts = [];
  const contains = [];
  for (const [name, emoji] of Object.entries(SHORTCODES)) {
    if (name.startsWith(p)) starts.push([name, emoji]);
    else if (name.includes(p)) contains.push([name, emoji]);
  }
  return [...starts, ...contains].slice(0, limit);
}

// Emoji-only messages (1–3 emoji) are shown big, Messenger-style.
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u;
export function isEmojiOnly(text) {
  return EMOJI_ONLY.test(String(text || '').trim());
}

// Messages that deserve confetti.
export function isCelebration(text) {
  return /🎉|🥳|🎊|🍾|\bcongrat|happy birthday|\bhbd\b|\bwe did it\b|\bshipped\b/i.test(String(text || ''));
}
