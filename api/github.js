// Vercel Serverless Function - Proxy pour GitHub Contributions
// Remplace les proxys CORS tiers instables (corsproxy.io, allorigins.win)

export default async function handler(req, res) {
    const username = req.query.user || 'osama-jammi';

    try {
        const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`);

        if (!response.ok) {
            // Fallback to the other API
            const fallback = await fetch(`https://github-contributions.vercel.app/api/v1/${username}`);
            if (!fallback.ok) {
                return res.status(502).json({ error: 'Failed to fetch GitHub contributions from all sources' });
            }
            const data = await fallback.json();
            res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).json(data);
        }

        const data = await response.json();
        
        // Transform jogruber format to match the expected format
        const contributions = [];
        const years = [];
        
        for (const [year, yearContributions] of Object.entries(data.contributions)) {
            let yearTotal = 0;
            for (const day of yearContributions) {
                yearTotal += day.count;
                contributions.push({
                    date: day.date,
                    count: day.count,
                    intensity: day.level // 0-4
                });
            }
            years.push({
                year: year,
                total: yearTotal,
                range: { start: yearContributions[0]?.date, end: yearContributions[yearContributions.length - 1]?.date }
            });
        }
        
        // Sort years descending
        years.sort((a, b) => b.year.localeCompare(a.year));

        const result = {
            years,
            contributions
        };

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json(result);

    } catch (error) {
        console.error('GitHub contributions proxy error:', error);
        return res.status(500).json({ error: 'Internal error fetching contributions' });
    }
}
