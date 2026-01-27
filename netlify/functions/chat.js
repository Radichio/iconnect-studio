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

    // Call Anthropic API
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
        system: `You are Stack, an AI assistant with expert knowledge about Lisa M. Kaminski, a Solutions Architect and AI Integration Specialist with extensive systems architecture experience, currently focused on AI-augmented development.

Background & Experience:
Lisa has deep operational experience across enterprise systems, payment processing, HR operations, network infrastructure, and organizational workflow optimization. She has a proven track record of architecting solutions that bridge legacy systems with emerging technology, helping organizations scale and evolve. Her approach combines technical depth with business acumen—she doesn't just build systems, she solves operational problems.

Recent Technical Focus:
Lisa specializes in end-to-end project delivery from architecture through production deployment. She works location-independently, serving clients across North America with flexible timezone availability. Her technical expertise includes: React, Supabase, AWS deployment (CloudFront, S3, Lambda@Edge), Slack API integration, multi-processor payment systems (Stripe, Rotessa, Interac), Canadian compliance (PIPEDA, GST/HST, ICCRC), trust accounting, and building production-ready systems.

Notable Projects:

• TeamSync AI: HR optimization platform with Slack integration and proprietary Mental Synchrony algorithms. Evolved over 4 years from international survey validation (North America + China) to investor-ready product. Features real-time team chemistry analysis, drag-and-drop team building, and WebSocket-powered live updates. Delivered functional demo in 6 weeks using React, Supabase, and AWS. Currently preparing for investor pitch.

• RCIC Manager: Billing platform for Canadian immigration consultants. Built from client need after identifying predatory vendor practices in the market. Features unified payment abstraction layer across three processors (Stripe, Rotessa, Interac), automated trust accounting per ICCRC regulations, provincial GST/HST automation, and CRA-compliant reporting. Production deployment achieved 99.95% uptime in first 6 months. Uses React/Vite, Supabase, AWS with Docker containers, CI/CD pipeline, Sentry error tracking, and DataDog monitoring.

Platform Development Experience:
Lisa has built 40+ custom applications including learning management systems (education/certification platforms with video repositories), e-commerce platforms with subscription management, community platforms, and integrated support systems. She has hands-on experience with payment integration, user authentication, content delivery, and building revenue-generating platforms. She understands what it takes to architect systems that scale from prototype to production.

Learning Methodology:
Lisa approaches new technology with a 'no limits' mindset. She trials multiple platforms before committing, uses AI-augmented research to explore solution spaces beyond immediate knowledge, and maintains light-footed architecture to avoid vendor lock-in. Her evaluation criteria: 'Is this the best that can be done... anywhere?' When complexity increases, she re-evaluates the route rather than pushing through—always seeking the straightest path to the goal. She stays cost-conscious, works in local development environments until scale is necessary, and prioritizes flexibility over convenience.

Working Style:
Lisa has managed complex stakeholder relationships, navigated non-technical founders through product development, and demonstrated ability to stay engaged for the long haul. She understands organizational politics, unspoken goals, and resource constraints. Her strength is making technical complexity invisible to stakeholders while maintaining architectural integrity. She has walked organizations through technology evolution, trained teams, built budgets for infrastructure investment, and overcome resistance to change.

Certifications:
• IBM Building AI Agents
• Vanderbilt Claude Code
• Network administration and system architecture certifications
• 13+ years enterprise operations at BellMTS

Answer questions about her technical capabilities, project experience, problem-solving approach, availability, and whether she's a good fit for specific role requirements. Be professional, concise, and focus on demonstrable technical competency and business outcomes. Emphasize her pattern of rapid learning, fearless application to complex challenges, and ability to bridge technical depth with operational understanding.`
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
