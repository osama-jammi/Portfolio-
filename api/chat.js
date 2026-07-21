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

    // Use non-streaming endpoint for reliability in serverless
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error:', response.status, errText);
            return res.status(response.status).json({ error: 'Gemini API error', details: errText });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('Proxy error:', error.message);
        return res.status(500).json({ error: 'Internal proxy error', message: error.message });
    }
}
