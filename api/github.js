// Vercel Serverless Function - Proxy pour GitHub Contributions
// Remplace les proxys CORS tiers instables

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

    const username = req.query.user || 'osama-jammi';

    // Try multiple sources in order
    const sources = [
        `https://github-contributions.vercel.app/api/v1/${username}`,
        `https://github-contributions-api.jogruber.de/v4/${username}?y=last`,
    ];

    for (const sourceUrl of sources) {
        try {
            const response = await fetch(sourceUrl);
            if (!response.ok) continue;

            const data = await response.json();

            // If jogruber format, transform it
            if (data.contributions && !Array.isArray(data.contributions)) {
                const contributions = [];
                const years = [];

                for (const [year, yearContribs] of Object.entries(data.contributions)) {
                    let yearTotal = 0;
                    for (const day of yearContribs) {
                        yearTotal += day.count;
                        contributions.push({
                            date: day.date,
                            count: day.count,
                            intensity: day.level
                        });
                    }
                    years.push({
                        year: year,
                        total: yearTotal,
                        range: {
                            start: yearContribs[0]?.date,
                            end: yearContribs[yearContribs.length - 1]?.date
                        }
                    });
                }
                years.sort((a, b) => b.year.localeCompare(a.year));
                return res.status(200).json({ years, contributions });
            }

            // Already in expected format
            return res.status(200).json(data);

        } catch (e) {
            console.error(`Failed to fetch from ${sourceUrl}:`, e.message);
            continue;
        }
    }

    return res.status(502).json({ error: 'Failed to fetch GitHub contributions from all sources' });
}
