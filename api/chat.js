// Vercel Serverless Function - Proxy pour Groq API (gratuit, rapide)
// Utilise une clé API Groq stockée dans les variables d'environnement Vercel
// Inscription gratuite avec GitHub : https://console.groq.com

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
        console.error('GROQ_API_KEY not found in environment variables');
        return res.status(500).json({ error: 'GROQ_API_KEY not configured in Vercel environment variables' });
    }

    // Convert Gemini request format to OpenAI/Groq format
    const body = req.body;
    const messages = [];

    if (body.contents && Array.isArray(body.contents)) {
        for (const content of body.contents) {
            const role = content.role === 'model' ? 'assistant' : content.role;
            const text = content.parts?.map(p => p.text).join('') || '';
            // First user message contains system context
            if (messages.length === 0 && role === 'user') {
                messages.push({ role: 'system', content: text });
            } else {
                messages.push({ role, content: text });
            }
        }
    }

    // Models to try in order (all free on Groq)
    const models = [
        'llama-3.1-8b-instant',
        'llama3-8b-8192',
        'gemma2-9b-it',
    ];

    let lastError = null;

    for (const model of models) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
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

                // Return in Gemini-compatible format (so frontend needs no changes)
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
            console.error(`Groq API error (${model}):`, response.status, errText);

            // If rate limited, try next model
            if (response.status === 429) {
                lastError = { status: 429, model, details: errText };
                continue;
            }

            return res.status(response.status).json({ error: `Groq API error (${model})`, details: errText });

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
