// Vercel Serverless Function - Proxy pour Google Gemini API
// La clé API est stockée dans les variables d'environnement Vercel

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

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY not found in environment variables');
        return res.status(500).json({ error: 'API key not configured' });
    }

    // Try multiple models in order of preference (in case quota is hit on one)
    const models = [
        'gemini-2.0-flash-lite',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
    ];

    let lastError = null;

    for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body),
            });

            if (response.ok) {
                const data = await response.json();
                return res.status(200).json(data);
            }

            const errText = await response.text();
            console.error(`Gemini API error (${model}):`, response.status, errText);

            // If it's a quota error (429), try next model
            if (response.status === 429) {
                lastError = { status: response.status, model, details: errText };
                continue;
            }

            // For other errors, return immediately
            return res.status(response.status).json({ error: `Gemini API error (${model})`, details: errText });

        } catch (error) {
            console.error(`Proxy error (${model}):`, error.message);
            lastError = { status: 500, model, message: error.message };
            continue;
        }
    }

    // All models exhausted
    console.error('All Gemini models quota exhausted:', lastError);
    return res.status(429).json({
        error: 'Tous les modèles Gemini ont atteint leur quota. Réessayez dans quelques minutes.',
        details: lastError
    });
}
