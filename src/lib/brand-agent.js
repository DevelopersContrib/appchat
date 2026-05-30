function cleanText(value = '') {
  return String(value || '').trim();
}
import { resolveToneProfile } from './brand-agent-profiles.js';

function includesAny(text, words) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

export function buildBrandAgentReply({ messageBody, meetingAbout, expectedAttendees, expectedContributions, senderName, toneProfile }) {
  const body = cleanText(messageBody);
  if (!body || body.length < 2) return null;

  const about = cleanText(meetingAbout);
  const attendees = cleanText(expectedAttendees);
  const contributions = cleanText(expectedContributions);
  const isQuestion = body.includes('?');
  const name = cleanText(senderName) || 'team';
  const tone = resolveToneProfile(toneProfile);

  if (includesAny(body, ['summary', 'recap', 'summarize', 'notes'])) {
    return [
      `Great question, ${name}. Thanks for calling this out.`,
      tone.id === 'executive' ? 'I will keep this focused on decision-ready facts.' : 'Here is a live summary so far:',
      `- Objective: ${about || 'Not finalized yet. Please confirm the meeting objective.'}`,
      `- Expected attendees: ${attendees || 'Still being confirmed.'}`,
      `- Expected contributions: ${contributions || 'Still being clarified.'}`,
      '- Next step: Once everyone confirms their contribution, I will produce action items with owners.',
      'Deep question: which single outcome would make this meeting a clear win for the brand today?',
    ].join('\n');
  }

  if (includesAny(body, ['who', 'attendee', 'joining', 'participant'])) {
    return [
      `Good call, ${name}.`,
      tone.id === 'coach' ? 'Appreciate you keeping everyone aligned.' : '',
      `Current expected attendees: ${attendees || 'not defined yet.'}`,
      attendees
        ? 'If anyone is missing, please add them now so I can align expected roles.'
        : 'Please share names/roles and I will track attendance against the expected list.',
      'Deep question: whose input is most critical to unlock the brand goal for this call?',
    ].join('\n');
  }

  if (includesAny(body, ['contribution', 'role', 'owner', 'responsible'])) {
    return [
      `Understood, ${name}. I am tracking contribution ownership.`,
      tone.id === 'consultative' ? 'I will map this to impact and sequencing.' : '',
      `Current expectation: ${contributions || 'not set yet.'}`,
      'If needed, I can restate this as a simple owner checklist in the next message.',
      'Deep question: which contribution creates the biggest impact on our target outcome?',
    ].join('\n');
  }

  if (includesAny(body, ['about', 'objective', 'goal', 'purpose', 'scope'])) {
    return [
      `Thanks, ${name}. I am locking in the objective.`,
      tone.id === 'executive' ? 'I will keep the conversation tied to outcomes and owners.' : '',
      `Current meeting objective: ${about || 'not confirmed yet.'}`,
      'If this has changed, post the updated objective and I will align the discussion around it.',
      'Deep question: how does this objective directly strengthen the brand right now?',
    ].join('\n');
  }

  if (isQuestion) {
    return [
      `Thoughtful take, ${name}.`,
      tone.id === 'concierge' ? 'Happy to help keep this smooth and productive.' : '',
      `- Objective anchor: ${about || 'Please confirm the objective first.'}`,
      `- People in scope: ${attendees || 'Please confirm expected attendees.'}`,
      `- Contribution expectation: ${contributions || 'Please define expected contributions.'}`,
      'Deep question: what would we regret not addressing before this meeting ends?',
    ].join('\n');
  }

  return [
    `Noted, ${name}. I captured that.`,
    tone.id === 'coach' ? 'Thanks for sharing that context.' : '',
    'To keep this productive, I recommend we confirm:',
    `1) Objective: ${about || 'pending'}`,
    `2) Attendees: ${attendees || 'pending'}`,
    `3) Contributions: ${contributions || 'pending'}`,
    'Deep question: which decision today will most move our brand goal forward this week?',
  ].filter(Boolean).join('\n');
}
