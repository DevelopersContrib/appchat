import { NextResponse } from 'next/server';

export async function GET() {
  const agentCard = {
    schema_version: '1.0',
    name: 'AppChat',
    description: 'White-label meeting platform with AI agents. Chat, HD video, voice calls, and an AI agent that joins your conversations — takes notes, answers questions, and follows up automatically.',
    url: 'https://appchat.com',
    logo: 'https://www.brandidentity.com/logo/appchat.com',
    contact_email: 'support@appchat.com',
    legal_info_url: 'https://appchat.com/terms',
    privacy_policy_url: 'https://appchat.com/privacy',

    capabilities: {
      chat: {
        description: 'Real-time persistent messaging with channels, DMs, threads, and file sharing.',
        protocols: ['https'],
      },
      video: {
        description: 'HD video conferencing via LiveKit with screen sharing, recording, and guest invite links.',
        provider: 'LiveKit Cloud',
        protocols: ['webrtc', 'https'],
      },
      voice: {
        description: 'Voice calls with the same infrastructure as video.',
        provider: 'LiveKit Cloud',
        protocols: ['webrtc'],
      },
      ai_agent: {
        description: 'AI participant that joins rooms, takes notes, answers brand-specific questions, and posts summaries to CRM.',
        features: ['note_taking', 'question_answering', 'call_summary', 'crm_integration', 'brand_knowledge'],
      },
      daily_rooms: {
        description: 'Embedded video chat rooms via Daily.co with screen sharing.',
        provider: 'Daily.co',
      },
    },

    integrations: {
      crm: {
        description: 'Webhook-based CRM integration. Call summaries and contact data flow to your pipeline.',
        webhook_format: 'json',
      },
      google_drive: {
        description: 'Browse, search, and share Google Drive files in chat. OAuth2 per-user authentication.',
        scopes: ['drive.readonly'],
      },
      brand_identity: {
        description: 'Per-tenant logos, fonts, and typography from brandidentity.com.',
        provider: 'brandidentity.com',
      },
    },

    multi_tenant: {
      description: 'Each organization gets their own workspace with custom branding, subdomain routing, and isolated data.',
      subdomain_pattern: '{tenant}.appchat.com',
      path_pattern: 'appchat.com/{tenant}',
      custom_domains: true,
    },

    api: {
      base_url: 'https://appchat.com/api',
      authentication: 'JWT (cookie-based)',
      endpoints: {
        brand_context: '/api/brand-context/{tenant}',
        rooms_public: '/api/rooms/public',
        channels: '/api/channels',
        messages: '/api/channels/{id}/messages',
        livekit_token: '/api/livekit/token',
        daily_room: '/api/daily/room',
        gdrive_files: '/api/gdrive/files',
        unfurl: '/api/unfurl',
      },
    },

    ecosystem: [
      { name: 'VNOC', url: 'https://vnoc.com', role: 'Operations Hub' },
      { name: 'GrowAgent', url: 'https://growagent.com', role: 'CRM & Outreach' },
      { name: 'VentureOS', url: 'https://ventureos.com', role: 'Enterprise Platform' },
      { name: 'AgentDAO', url: 'https://agentdao.com', role: 'Agent Network' },
      { name: 'PayDirect', url: 'https://paydirect.com', role: 'Billing' },
    ],
  };

  return NextResponse.json(agentCard, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
