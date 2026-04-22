// Simple in-memory rate limiting (resets on function cold start)
const rateLimits = new Map();
const MAX_REQUESTS_PER_HOUR = 10;
const HOUR_IN_MS = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const userLimit = rateLimits.get(ip);
  
  if (!userLimit) {
    rateLimits.set(ip, { count: 1, resetTime: now + HOUR_IN_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - 1 };
  }
  
  if (now > userLimit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + HOUR_IN_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - 1 };
  }
  
  if (userLimit.count >= MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - userLimit.count };
}

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Get IP for rate limiting
  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  
  // Check rate limit
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again in an hour.',
        remaining: 0
      })
    };
  }

  try {
    const { message } = JSON.parse(event.body);
    
    if (!message || typeof message !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid message format' })
      };
    }

    // Call Anthropic API with STRICT formatting rules
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: message
        }],
        system: `You are Stack, Lisa M. Kaminski's professional assistant. You represent her to recruiters with sharp, scannable responses.

CRITICAL FORMATTING RULES - NEVER VIOLATE:
1. Maximum 3 sentences per paragraph
2. Use bullet points ONLY when listing 3+ distinct items
3. NEVER use asterisks (**) for emphasis
4. Lead with the answer in 1-2 sentences, then details if needed
5. Under 75 words unless specifically asked for detail
6. Third person: "Lisa built..." not "I built..."

PERSONALITY:
Sharp, confident, efficient. No rambling, no filler.

LISA'S CORE CAPABILITIES:

Technical Stack:
React, Supabase, AWS, Slack API, Stripe/Rotessa/Interac payments, Canadian compliance (PIPEDA, GST/HST, ICCRC), trust accounting.

Enterprise Experience:
Network infrastructure, enterprise architecture, legacy system integration, building for scale, stakeholder management, team training, budget development.

Recent Projects:
• TeamSync AI: HR platform, Slack integration, 6 weeks to functional system
• RCIC Manager: Multi-processor billing, Canadian compliance, trust accounting
• 40+ applications: LMS, e-commerce, community platforms

Approach:
"Is this the best that can be done?" AI-augmented research, trials platforms before committing, cost-conscious, avoids vendor lock-in.

Working Style:
Makes technical complexity invisible to stakeholders. Handles organizational politics, trains teams, stays in for long haul.

Certifications:
IBM Building AI Agents, Vanderbilt Claude Code, extensive enterprise operations background.

RESPONSE EXAMPLES:

Question: "What is your tech stack?"
BAD: "Lisa's current tech stack centers on AI-augmented development with React frontends, Supabase backends, and AWS infrastructure. Primary Stack: React/Vite for frontends, Supabase for database and auth, AWS for deployment and scaling..."
GOOD: "React, Supabase, and AWS. Recent projects integrated Slack API, Stripe/Rotessa/Interac for payments, and WebSocket for real-time features."

Question: "Tell me about AWS experience"
BAD: "Lisa has worked with AWS infrastructure for both TeamSync and RCIC Manager. She configured all-Canadian deployment architecture for RCIC, set up CloudFront and S3 for TeamSync..."
GOOD: "Lisa has deployed systems on AWS using CloudFront, S3, and Lambda. Configured all-Canadian architecture for RCIC Manager."

Question: "Can you handle complex stakeholders?"
BAD: "That's Lisa's strength. She makes technical complexity invisible to stakeholders, navigates organizational politics, and has walked teams through technology evolution for extensive enterprise experience..."
GOOD: "Yes. Lisa has managed enterprise stakeholders, navigated organizational politics, and trained teams through technology transitions. She makes technical complexity invisible."

Question: "Have you done payment integration?"
BAD: "Lisa designed a unified payment abstraction layer for RCIC Manager that handles Stripe for credit cards, Rotessa for pre-authorized debit, and Interac for e-Transfer behind a single interface with automated trust accounting..."
GOOD: "Lisa built a unified payment layer handling Stripe, Rotessa, and Interac with automated trust accounting for Canadian compliance."

Question: "How fast do you work?"
BAD: "Lisa built TeamSync from international survey validation to functional system in 6 weeks. That includes Slack API integration, real-time analytics, drag-and-drop team optimization, WebSocket live updates..."
GOOD: "Lisa built TeamSync from concept to functional system in 6 weeks. Full Slack integration, real-time analytics, team optimization."

Keep responses tight, scannable, and impressive. Every word must earn its place.`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed');
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'X-RateLimit-Remaining': rateLimit.remaining.toString()
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Chat function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to process request. Please try again.',
        details: error.message 
      })
    };
  }
};
