# iConnect Studio Portfolio - Deployment Guide

## Stack AI Assistant - Serverless Setup

Your portfolio now includes **Stack**, an AI assistant that answers questions about your technical capabilities. It uses a secure serverless backend to protect your Anthropic API key.

---

## 🚀 Netlify Deployment Steps

### 1. Push to GitHub

```bash
cd /path/to/your/portfolio
git init
git add .
git commit -m "Initial portfolio with Stack AI"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### 2. Connect to Netlify

1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Choose GitHub and select your repository
4. Build settings:
   - **Build command:** (leave empty)
   - **Publish directory:** `.`
   - **Functions directory:** `netlify/functions` (auto-detected)

### 3. Set Environment Variables

In Netlify dashboard: **Site settings → Environment variables**

Add these two variables:

**ANTHROPIC_API_KEY**
```
sk-ant-your-actual-api-key-here
```

**STACK_SYSTEM_PROMPT**
```
You are Stack, an AI assistant with expert knowledge about Lisa M. Kaminski, a Solutions Architect and AI Integration Specialist with extensive systems architecture experience, currently focused on AI-augmented development.

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

Answer questions about her technical capabilities, project experience, problem-solving approach, availability, and whether she's a good fit for specific role requirements. Be professional, concise, and focus on demonstrable technical competency and business outcomes. Emphasize her pattern of rapid learning, fearless application to complex challenges, and ability to bridge technical depth with operational understanding.
```

### 4. Deploy

Click **Deploy site** - Netlify will build and deploy automatically!

---

## 🧪 Test Locally (Optional)

Install Netlify CLI:
```bash
npm install -g netlify-cli
```

Create `.env` file in project root:
```bash
cp .env.example .env
# Edit .env and add your actual API key
```

Run locally:
```bash
netlify dev
```

Visit: `http://localhost:8888`

---

## 🔒 Security Features

- **API key hidden:** Never exposed to browser
- **Rate limiting:** 10 messages/hour per IP
- **CORS protection:** Only your domain can call the function
- **Error handling:** Graceful degradation if API fails

---

## 💰 Cost Estimate

**With normal recruiter traffic:**
- 50 visitors/month
- 5 messages per visitor
- 250 total messages/month

**Estimated cost:** $3-5/month

Claude Sonnet 4 pricing:
- Input: ~$3 per million tokens
- Output: ~$15 per million tokens

---

## 🎯 Custom Domain Setup

1. Buy domain (Namecheap, Google Domains, etc.)
2. In Netlify: **Domain settings → Add custom domain**
3. Update DNS records:
   - Type: `A`
   - Name: `@`
   - Value: (Netlify provides this)
4. SSL certificate auto-provisions in ~24 hours

---

## 📊 Monitoring

**Netlify Dashboard:**
- Functions tab → See usage, errors, logs
- Analytics tab → Traffic, top pages
- Forms tab → Contact form submissions

**Check function health:**
```
https://your-site.netlify.app/.netlify/functions/chat
```

Should return: `{"error": "Method Not Allowed"}`

---

## 🐛 Troubleshooting

**"Error connecting to Stack"**
- Check Netlify function logs
- Verify environment variables are set
- Check Anthropic API key is valid

**"Rate limit exceeded"**
- Normal behavior (10 msgs/hour per IP)
- User sees friendly message
- Resets after 1 hour

**Function not found**
- Check `netlify.toml` is in root
- Verify `netlify/functions/chat.js` exists
- Redeploy site

---

## 📝 Notes

- Rate limiting resets on function cold start (serverless nature)
- First request may be slow (~2-3 seconds) due to cold start
- Subsequent requests are fast (<1 second)
- Free Netlify tier: 125k function calls/month (more than enough)

---

**Need help?** Check Netlify docs or Anthropic API docs
