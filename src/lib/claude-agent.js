import Anthropic from '@anthropic-ai/sdk';
import { resolveToneProfile } from './brand-agent-profiles.js';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-1-20250805';
let client = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function buildSystemPrompt({ meetingAbout, expectedAttendees, expectedContributions, brandDomain, toneProfile }) {
  const tone = resolveToneProfile(toneProfile);
  return [
    'You are Brand Agent inside a live meeting chat.',
    'Your job is to be thoughtful, warm, concise, and practical.',
    'You must help the team clarify objective, attendees, and expected contributions.',
    `Tone profile: ${tone.label}.`,
    `Tone guidance: ${tone.guidance}`,
    'Conversation behavior:',
    '- Start with one natural human acknowledgment.',
    '- Add one useful observation tied to current meeting context.',
    '- End with one deeper question connected to brand goals or meeting outcomes.',
    '- Avoid robotic phrasing and avoid repeating the exact same template.',
    'Output constraints:',
    '- Keep responses under 140 words unless explicitly asked for a full summary.',
    '- Prefer bullet points when listing actions or owners.',
    '- If context is missing, ask one sharp follow-up question.',
    '',
    `Brand domain: ${brandDomain || 'Not provided yet.'}`,
    `Meeting objective: ${meetingAbout || 'Not provided yet.'}`,
    `Expected attendees: ${expectedAttendees || 'Not provided yet.'}`,
    `Expected contributions: ${expectedContributions || 'Not provided yet.'}`,
  ].join('\n');
}

function flattenContent(content = []) {
  return content
    .filter((block) => block?.type === 'text' && block?.text)
    .map((block) => block.text.trim())
    .join('\n')
    .trim();
}

export async function generateClaudeAgentReply({
  latestUserMessage,
  recentMessages,
  meetingAbout,
  expectedAttendees,
  expectedContributions,
  brandDomain,
  toneProfile,
}) {
  const anthropic = getClient();
  if (!anthropic || !latestUserMessage?.trim()) return null;

  const history = (recentMessages || [])
    .slice(-10)
    .map((m) => `${m.role === 'assistant' ? 'Agent' : 'User'}: ${m.content}`)
    .join('\n');

  const prompt = [
    'Recent chat history:',
    history || 'No previous context.',
    '',
    `Latest user message: ${latestUserMessage}`,
    '',
    'Respond as Brand Agent for this meeting.',
  ].join('\n');

  try {
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 320,
      system: buildSystemPrompt({ meetingAbout, expectedAttendees, expectedContributions, brandDomain, toneProfile }),
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return flattenContent(response.content) || null;
  } catch {
    return null;
  }
}
