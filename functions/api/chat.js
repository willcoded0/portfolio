export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost({ request, env }) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return json({ error: 'Expected JSON body.' }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const userText = String(body.message || '').trim();
  const rawHistory = Array.isArray(body.history) ? body.history : [];

  if (!userText) return json({ error: 'Message is required.' }, 400);
  if (userText.length > 500) return json({ error: 'Message is too long.' }, 400);

  const ollamaUrl = env.OLLAMA_CHAT_URL || 'https://ollama.batmap.win/api/chat';
  const model = env.OLLAMA_MODEL || 'qwen2.5:3b';

  const safeHistory = rawHistory
    .filter((msg) => msg && ['user', 'assistant'].includes(msg.role) && typeof msg.content === 'string')
    .slice(-8)
    .map((msg) => ({ role: msg.role, content: msg.content.slice(0, 1200) }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), 45_000);

  try {
    const upstream = await fetch(ollamaUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.OLLAMA_PROXY_TOKEN ? { authorization: `Bearer ${env.OLLAMA_PROXY_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        options: {
          temperature: 0.3,
          num_ctx: 4096,
          num_predict: 240,
        },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...safeHistory,
          { role: 'user', content: userText },
        ],
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      return json({ error: 'LLM backend unavailable.', detail: detail.slice(0, 200) }, 502);
    }

    const data = await upstream.json();
    const reply = String(data?.message?.content || data?.response || '').trim();
    return json({ reply: reply || 'Sorry, I got an empty response.' });
  } catch (error) {
    return json({ error: 'LLM request timed out or failed.' }, 504);
  } finally {
    clearTimeout(timeout);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
  };
}

const SYSTEM_PROMPT = `You are William Hall's portfolio assistant. Answer only from the portfolio facts below. Be concise, friendly, and specific. If a question is outside these facts, say you only have information about William's portfolio.

William Hall:
- Systems Engineer & Security Analyst.
- BBA in Management Information Systems at Baylor University in Waco, TX. GPA 3.5, expected May 2027.
- Seeking Summer 2026 internships in systems engineering, security, infrastructure, fraud/risk, IT, or data analytics.

Experience:
- Fraud Analyst at FanDuel, Jul 2025 to present: investigates AML, identity theft, fraud cases, behavioral patterns, and transaction anomalies.
- PC Hardware & Systems Engineering, self-directed since 2014: 10+ years building, troubleshooting, and repairing PC hardware.

Projects:
1. Homelab Virtualization & Security Infrastructure: Proxmox VE, GPU passthrough, Cloudflare Tunnel, Zero Trust networking, VMs/LXCs. github.com/willcoded0/homelab-infra-proxmox
2. Local LLM Deployment: Qwen/Gemma-class model served by Ollama from a GPU-backed homelab VM for this portfolio chatbot. github.com/willcoded0/homelab-llm-qwen
3. Game Server + Web Map: Minecraft + Dynmap via Cloudflare Tunnel. github.com/willcoded0/minecraft-dynmap-cloudflare-tunnel
4. AI-Powered Discord Analyzer: Python bot using OpenAI API for message analysis and role management. github.com/willcoded0/Role-Rotator
5. Pokemon Fangame: RPG Maker XP, Ruby scripting, custom maps and storyline.
6. Financial Analytics Dashboard: Python/Pandas ETL and Power BI with anomaly detection.

Skills: Fraud Investigation, AML, Threat Detection, Linux CLI, Proxmox VE, networking, GPU passthrough, Python, JavaScript, SQL, HTML/CSS, Git, REST APIs, PC hardware, Cloudflare, Zero Trust, Power BI, Ollama, OpenAI API, local LLMs.

Contact: will_hall1@baylor.edu, linkedin.com/in/william-hall-7091572a0/, github.com/willcoded0.`;
