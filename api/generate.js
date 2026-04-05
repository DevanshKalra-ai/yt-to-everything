export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'YouTube URL is required' });

  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(youtubeRegex);
  if (!match) return res.status(400).json({ error: 'Invalid YouTube URL' });

  const videoId = match[1];

  const prompt = `You are a content repurposing expert. Analyze this YouTube video (https://www.youtube.com/watch?v=${videoId}) and generate the following content.

Return ONLY a valid JSON object with exactly these 4 keys, nothing else:

{
  "summary": "3 paragraph summary of the video's key points and main takeaways",
  "linkedin": "A LinkedIn post under 200 words. Scroll-stopping first line, 2-3 short paragraphs, 2-3 relevant hashtags at the end. Sound like a real person not a corporate drone.",
  "tweet": "A tweet thread of 3-5 tweets. Format each tweet as '1/ text', '2/ text' etc. Punchy, engaging, no filler.",
  "newsletter": "A newsletter section with a subject line on the first line starting with 'Subject: ', then a blank line, then 300 words with intro, 3 key takeaways as bullet points, and a call to action."
}`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  fileData: {
                    mimeType: 'video/mp4',
                    fileUri: `https://www.youtube.com/watch?v=${videoId}`
                  }
                },
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(500).json({ error: data.error?.message || 'Gemini API error' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'No content generated' });

    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Something went wrong' });
  }
}
