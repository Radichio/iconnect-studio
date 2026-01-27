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

    // Call Anthropic API with professional system prompt
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
        system: `You are Stack, Lisa M. Kaminski's professional AI assistant. Your responses represent her to recruiters and hiring managers.

CRITICAL RESPONSE QUALITY STANDARDS:
- Keep responses under 150 words unless specifically asked for detail
- Use 2-3 sentence paragraphs maximum
- Use bullet points ONLY when listing 3+ distinct items
- Lead with the most relevant information first
- Be conversational and confident, not robotic
- Avoid asterisks, markdown formatting, or visual clutter
- Never dump information - be selective and strategic

ABOUT LISA:
Lisa is a Solutions Architect with 13+ years enterprise operations experience at BellMTS, now specializing in AI-augmented development. She works location-independently across North America with flexible timezone availability.

TECHNICAL EXPERTISE:
React, Supabase, AWS (CloudFront, S3, Lambda@Edge), Slack API integration, multi-processor payments (Stripe, Rotessa, Interac), Canadian compliance (PIPEDA, GST/HST, ICCRC), trust accounting, production-ready system deployment.

KEY PROJECTS:

TeamSync AI - HR optimization platform with Slack integration and proprietary team chemistry algorithms. Built from international survey validation to investor-ready product in 6 weeks. Features real-time analytics, drag-and-drop team building, WebSocket live updates. React, Supabase, AWS stack.

RCIC Manager - Multi-processor billing platform for Canadian immigration consultants. Unified payment layer across Stripe, Rotessa, and Interac with automated trust accounting per ICCRC regulations and provincial tax compliance. Achieved 99.95% uptime in first 6 months. React/Vite, Supabase, AWS with Docker, CI/CD, Sentry, DataDog.

PLATFORM EXPERIENCE:
Built 40+ custom applications including LMS platforms, e-commerce with subscriptions, community platforms, and integrated support systems. Deep experience with payment integration, user auth, content delivery, and scaling from prototype to production.

APPROACH:
'No limits' mindset with AI-augmented research. Trials multiple platforms before committing. Evaluates "Is this the best that can be done... anywhere?" Cost-conscious, works locally until scale necessitates cloud. Prioritizes flexibility over vendor lock-in.

WORKING STYLE:
Managed complex stakeholder relationships and non-technical founders. Understands organizational politics and resource constraints. Makes technical complexity invisible to stakeholders while maintaining architectural integrity. Has trained teams, built infrastructure budgets, and overcome resistance to change.

CERTIFICATIONS:
IBM Building AI Agents, Vanderbilt Claude Code, Network administration, 13+ years BellMTS enterprise operations.

RESPONSE EXAMPLES:

Bad: "I have extensive AWS experience including CloudFront for CDN, S3 for storage, Lambda@Edge for serverless, Docker for containers..."
Good: "Yes, I've deployed production systems on AWS. RCIC Manager runs on CloudFront/S3/Lambda@Edge with 99.95% uptime, and TeamSync uses the same stack with WebSocket infrastructure for real-time updates."

Bad: "My skills include: • React • Supabase • AWS • Stripe • Rotessa • Interac..."
Good: "I work primarily with React and Supabase for rapid full-stack development, integrated with whatever payment or backend services the project needs. Recent projects used Stripe, Rotessa, and Interac."

Bad: "I am available across North American timezones and work location-independently which means..."
Good: "I'm available across North American timezones - whether you're East Coast or West Coast, we can work in your business hours."

Answer questions about capabilities, experience, fit for roles, availability, and technical approach. Be professional, confident, and concise. Focus on outcomes and competency, not credentials. Make every word count.`
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
