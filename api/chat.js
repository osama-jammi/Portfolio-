// Vercel Serverless Function - Proxy pour GitHub Models API
// Utilise un GitHub Personal Access Token stocké dans les variables d'environnement

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    if (!GITHUB_TOKEN) {
        console.error('GITHUB_TOKEN not found in environment variables');
        return res.status(500).json({ error: 'GitHub token not configured' });
    }

    // Convert Gemini format to OpenAI format
    const body = req.body;
    const messages = [];

    if (body.contents && Array.isArray(body.contents)) {
        for (const content of body.contents) {
            const role = content.role === 'model' ? 'assistant' : content.role;
            const text = content.parts?.map(p => p.text).join('') || '';
            // First user message with cvContext becomes system message
            if (messages.length === 0 && role === 'user') {
                messages.push({ role: 'system', content: text });
            } else {
                messages.push({ role, content: text });
            }
        }
    }

    const models = [
        'gpt-4o-mini',
        'Meta-Llama-3.1-8B-Instruct',
    ];

    let lastError = null;

    for (const model of models) {
        const url = 'https://models.inference.ai.github.com/chat/completions';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: body.generationConfig?.temperature || 0.3,
                    max_tokens: body.generationConfig?.maxOutputTokens || 2048,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const text = data.choices?.[0]?.message?.content || '';

                // Return in Gemini-compatible format so frontend doesn't need changes
                return res.status(200).json({
                    candidates: [{
                        content: {
                            parts: [{ text }],
                            role: 'model'
                        }
                    }]
                });
            }

            const errText = await response.text();
            console.error(`GitHub Models error (${model}):`, response.status, errText);

            if (response.status === 429) {
                lastError = { status: response.status, model, details: errText };
                continue;
            }

            return res.status(response.status).json({ error: `GitHub Models error (${model})`, details: errText });

        } catch (error) {
            console.error(`Proxy error (${model}):`, error.message);
            lastError = { status: 500, model, message: error.message };
            continue;
        }
    }

    console.error('All models failed:', lastError);
    return res.status(429).json({
        error: 'Tous les modèles sont indisponibles. Réessayez dans quelques minutes.',
        details: lastError
    });
}
