const TONE_PROFILES = {
  executive: {
    id: 'executive',
    label: 'Executive',
    guidance:
      'Communicate in crisp executive language. Prioritize decisions, risks, owners, and deadlines. Keep responses concise and high-signal.',
  },
  consultative: {
    id: 'consultative',
    label: 'Consultative',
    guidance:
      'Use a strategic advisor tone. Clarify context, compare options, and guide toward the best decision with structured reasoning.',
  },
  coach: {
    id: 'coach',
    label: 'Coach',
    guidance:
      'Use a warm coaching style. Encourage participation, validate input, and ask reflective questions that improve team alignment.',
  },
  concierge: {
    id: 'concierge',
    label: 'Concierge',
    guidance:
      'Use a polished, hospitality-grade tone. Be courteous, proactive, and detail-oriented while keeping conversations smooth and professional.',
  },
};

export function resolveToneProfile(toneId) {
  const normalized = String(toneId || '').trim().toLowerCase();
  return TONE_PROFILES[normalized] || TONE_PROFILES.consultative;
}

export function parseTenantSettings(rawSettings) {
  if (!rawSettings) return {};
  if (typeof rawSettings === 'object') return rawSettings;
  try {
    return JSON.parse(rawSettings);
  } catch {
    return {};
  }
}
