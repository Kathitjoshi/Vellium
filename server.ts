import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import { marked } from 'marked';

dotenv.config();

async function fetchSearchResults(query: string) {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: any[] = [];
    $('.result__body').each((i, el) => {
      const title = $(el).find('.result__title .result__a').text().trim();
      let link = $(el).find('.result__title .result__a').attr('href');
      const snippet = $(el).find('.result__snippet').text().trim();
      if (link && link.startsWith('//duckduckgo.com/l/?uddg=')) {
        link = decodeURIComponent(link.split('uddg=')[1].split('&')[0]);
      }
      if (title && link) {
        results.push({ title, link, snippet });
      }
    });
    return results.slice(0, 50);
  } catch (error) {
    console.error('Search fetch error:', error);
    return [];
  }
}

const app = express();
app.use(express.json());

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API Key is missing. Please add it to your environment variables.' });
    }

    // Fetch search results concurrently
    const searchPromise = fetchSearchResults(prompt);

    // Fetch AI answer
    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = `You are a helpful AI search assistant. 
Provide a clear, concise, and highly accurate summary or answer to the user's query.
Format your response in Markdown. Do not include HTML tags.`;

    let aiAnswerMarkdown = '';
    let aiError = '';

    try {
      let retries = 2;
      let aiResponse;
      while (retries > 0) {
        try {
          aiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.5,
            }
          });
          break;
        } catch (error: any) {
          if (error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('UNAVAILABLE')) {
            retries--;
            if (retries === 0) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw error;
          }
        }
      }
      aiAnswerMarkdown = aiResponse?.text || '';
    } catch (error: any) {
      let errorMessage = error?.message || 'Failed to generate content.';
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        aiError = '[SYS_ERR]: AI generation quota exceeded. Please try again later or check your API key billing details.';
      } else {
        aiError = `[SYS_ERR]: AI generation failed: ${errorMessage}`;
      }
      console.error('Error generating AI answer:', error);
    }

    const results = await searchPromise;

    const aiAnswerHtml = aiError 
      ? `<div class="text-red-400 font-mono text-sm bg-red-500/10 p-4 rounded-lg border border-red-500/20">${aiError}</div>`
      : marked.parse(aiAnswerMarkdown);

    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${prompt} - Vellium Search</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    /* Custom prose styles for dark mode */
    .prose-invert {
      --tw-prose-body: #d4d4d4;
      --tw-prose-headings: #22d3ee;
      --tw-prose-links: #67e8f9;
      --tw-prose-bold: #e5e5e5;
      --tw-prose-counters: #737373;
      --tw-prose-bullets: #525252;
      --tw-prose-hr: #404040;
      --tw-prose-quotes: #a3a3a3;
      --tw-prose-quote-borders: #404040;
      --tw-prose-captions: #a3a3a3;
      --tw-prose-code: #e5e5e5;
      --tw-prose-pre-code: #d4d4d4;
      --tw-prose-pre-bg: #171717;
      --tw-prose-th-borders: #525252;
      --tw-prose-td-borders: #404040;
    }
  </style>
</head>
<body class="bg-[#0a0a0a] text-neutral-200 min-h-screen selection:bg-cyan-500/30">
  <div class="max-w-4xl mx-auto p-6 md:p-8">
    <div class="mb-10">
      <h1 class="text-3xl font-semibold text-white tracking-tight mb-2 capitalize">${prompt}</h1>
      <p class="text-sm text-neutral-500 font-mono">Found ${results.length} results</p>
    </div>

    <!-- AI Answer Section -->
    <div class="mb-12 bg-[#111111] border border-neutral-800/80 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
      <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-600 to-blue-600"></div>
      <div class="flex items-center space-x-3 mb-6">
        <div class="w-8 h-8 rounded-full bg-cyan-950/50 flex items-center justify-center border border-cyan-900/50">
          <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        </div>
        <h2 class="text-lg font-medium text-cyan-100">AI Summary</h2>
      </div>
      <div class="prose prose-invert prose-cyan max-w-none text-base leading-relaxed">
        ${aiAnswerHtml}
      </div>
    </div>

    <!-- Web Results Section -->
    <div class="mb-6 flex items-center space-x-3 border-b border-neutral-800/80 pb-4">
      <div class="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center border border-neutral-800">
        <svg class="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
        </svg>
      </div>
      <h3 class="text-lg font-medium text-neutral-200">Web Results</h3>
    </div>
    
    <div class="space-y-6">
      ${results.length > 0 ? results.map(r => `
        <div class="group">
           <a href="${r.link}" target="_blank" class="block p-5 bg-[#111111] border border-neutral-800/50 hover:border-neutral-700 hover:bg-[#141414] rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
             <div class="flex items-center space-x-2 mb-2">
               <div class="w-5 h-5 rounded bg-neutral-800 flex items-center justify-center">
                 <svg class="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
               </div>
               <p class="text-xs text-neutral-400 font-medium truncate">${new URL(r.link.startsWith('http') ? r.link : 'https://'+r.link).hostname.replace('www.','')}</p>
             </div>
             <h4 class="text-lg font-medium text-blue-400 group-hover:text-blue-300 group-hover:underline decoration-blue-500/30 underline-offset-4 mb-2 leading-tight">${r.title}</h4>
             <p class="text-sm text-neutral-300 leading-relaxed line-clamp-2">${r.snippet}</p>
           </a>
        </div>
      `).join('') : '<p class="text-neutral-500 italic p-4 bg-neutral-900/30 rounded-lg">No web results found for this query.</p>'}
    </div>
  </div>
</body>
</html>`;

    res.json({ html: htmlTemplate });
  } catch (error: any) {
    console.error('Fatal generation error:', error);
    res.status(500).json({ error: error.message || 'An unexpected error occurred.' });
  }
});

// Setup Vite middleware for local development
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Start server if not running in serverless environment
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000;
  setupVite().then(() => {
    app.listen(PORT, '0.0.0.0' as any, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

// Export the Express app for Vercel
export default app;
