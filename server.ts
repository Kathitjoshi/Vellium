import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { marked } from 'marked';

dotenv.config();

function detectIntents(query: string) {
  return {
    weather: /\b(weather|temperature|forecast)\b/i.test(query),
    dictionary: /^(define|definition of|meaning of)\s+(.+)/i.test(query),
    images: /\b(images?|pics?|pictures?|photos?)\b/i.test(query),
    videos: /\b(videos?|youtube|watch)\b/i.test(query),
    math: /^[\d\s\+\-\*\/\(\)\.\^\%]+$/.test(query) || /^(calculate|calc|math)\s+/i.test(query),
    code: /\b(code|script|function|python|javascript|react|html|css|java|cpp|c\+\+|php)\b/i.test(query),
  };
}

async function fetchSearchResults(query: string, intents: ReturnType<typeof detectIntents>) {
  const qEncode = encodeURIComponent(query);
  const results: any[] = [];
  const widgets: any = {};
  
  const fetchPromises: Promise<any>[] = [
    fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${qEncode}&utf8=&format=json`)
      .then(res => res.json())
      .then(data => {
        (data.query?.search || []).slice(0, 5).forEach((item: any) => {
          results.push({
            title: item.title,
            link: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
            snippet: item.snippet.replace(/<[^>]*>?/gm, ''),
            source: 'Wikipedia'
          });
        });
      }).catch(e => console.error('Wikipedia error:', e)),

    fetch(`https://dev.to/api/articles?search=${qEncode}`)
      .then(res => res.json())
      .then(data => {
        data.slice(0, 5).forEach((item: any) => {
          results.push({
            title: item.title,
            link: item.url,
            snippet: item.description,
            source: 'Dev.to'
          });
        });
      }).catch(e => console.error('Dev.to error:', e)),

    fetch(`https://hn.algolia.com/api/v1/search?query=${qEncode}`)
      .then(res => res.json())
      .then(data => {
        data.hits.slice(0, 5).forEach((item: any) => {
          if (item.title && (item.url || item.story_url)) {
            results.push({
              title: item.title,
              link: item.url || item.story_url,
              snippet: 'HackerNews Discussion',
              source: 'HackerNews'
            });
          }
        });
      }).catch(e => console.error('HN error:', e)),

    fetch(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${qEncode}&site=stackoverflow`)
      .then(res => res.json())
      .then(data => {
        data.items.slice(0, 5).forEach((item: any) => {
          results.push({
            title: item.title,
            link: item.link,
            snippet: 'StackOverflow Question',
            source: 'StackOverflow'
          });
        });
      }).catch(e => console.error('SO error:', e)),

    fetch(`https://api.crossref.org/works?query=${qEncode}&select=title,URL,abstract&rows=5`)
      .then(res => res.json())
      .then(data => {
        data.message.items.forEach((item: any) => {
          results.push({
            title: item.title?.[0] || 'Unknown Title',
            link: item.URL,
            snippet: (item.abstract || '').replace(/<[^>]*>?/gm, '').substring(0, 200) || 'Academic Paper',
            source: 'Crossref'
          });
        });
      }).catch(e => console.error('Crossref error:', e)),

    fetch(`https://openlibrary.org/search.json?q=${qEncode}&limit=5`)
      .then(res => res.json())
      .then(data => {
        data.docs.forEach((item: any) => {
          results.push({
            title: item.title,
            link: `https://openlibrary.org${item.key}`,
            snippet: item.author_name?.join(', ') || 'Unknown author',
            source: 'OpenLibrary'
          });
        });
      }).catch(e => console.error('OpenLibrary error:', e)),

    fetch(`https://api.github.com/search/repositories?q=${qEncode}&per_page=5`)
      .then(res => res.json())
      .then(data => {
        data.items.forEach((item: any) => {
          results.push({
            title: item.full_name,
            link: item.html_url,
            snippet: item.description || 'GitHub Repository',
            source: 'GitHub'
          });
        });
      }).catch(e => console.error('GitHub error:', e)),

    fetch(`https://developer.mozilla.org/api/v1/search?q=${qEncode}`)
      .then(res => res.json())
      .then(data => {
        data.documents.slice(0, 5).forEach((item: any) => {
          results.push({
            title: item.title,
            link: `https://developer.mozilla.org${item.mdn_url}`,
            snippet: item.summary,
            source: 'MDN Web Docs'
          });
        });
      }).catch(e => console.error('MDN error:', e))
  ];

  if (intents.weather) {
      const cityMatch = query.replace(/\b(weather|temperature|forecast|in|for|what is the)\b/ig, '').trim() || 'London';
      fetchPromises.push(
          fetch(`https://wttr.in/${encodeURIComponent(cityMatch)}?format=j1`)
          .then(r => r.json())
          .then(data => {
              if (data && data.nearest_area && data.current_condition) {
                  widgets.weather = {
                      location: data.nearest_area[0].areaName[0].value,
                      temp: data.current_condition[0].temp_C,
                      desc: data.current_condition[0].weatherDesc[0].value,
                      feelsLike: data.current_condition[0].FeelsLikeC
                  };
              }
          }).catch(e => console.error('Weather error:', e))
      );
  }

  const dictMatch = query.match(/^(?:define|definition of|meaning of)\s+(.+)/i);
  if (dictMatch) {
      const word = dictMatch[1];
      fetchPromises.push(
          fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
          .then(r => r.json())
          .then(data => {
              if (data && data[0]) {
                 widgets.dictionary = {
                     word: data[0].word,
                     phonetic: data[0].phonetic,
                     meanings: data[0].meanings.slice(0, 2).map((m: any) => ({
                         partOfSpeech: m.partOfSpeech,
                         definition: m.definitions[0]?.definition
                     }))
                 };
              }
          }).catch(e => console.error('Dictionary error:', e))
      );
  }

  if (intents.images) {
      const imgQuery = query.replace(/\b(images?|pics?|pictures?|photos?|of|show me)\b/ig, '').trim() || 'nature';
      fetchPromises.push(
          fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(imgQuery)}&prop=imageinfo&iiprop=url&format=json`)
          .then(r => r.json())
          .then(data => {
              if (data.query && data.query.pages) {
                  widgets.images = Object.values(data.query.pages)
                      .map((p: any) => p.imageinfo?.[0]?.url)
                      .filter(Boolean)
                      .slice(0, 6);
              }
          }).catch(e => console.error('Images error:', e))
      );
  }

  if (intents.videos) {
      const vidQuery = query.replace(/\b(videos?|youtube|watch|show me)\b/ig, '').trim() || 'news';
      fetchPromises.push(
          fetch(`https://api.dailymotion.com/videos?search=${encodeURIComponent(vidQuery)}&limit=4&fields=id,title,thumbnail_360_url`)
          .then(r => r.json())
          .then(data => {
              if (data.list) {
                  widgets.videos = data.list.map((v: any) => ({
                      title: v.title,
                      thumbnail: v.thumbnail_360_url,
                      link: `https://www.dailymotion.com/video/${v.id}`
                  }));
              }
          }).catch(e => console.error('Videos error:', e))
      );
  }

  await Promise.allSettled(fetchPromises);
  
  return {
    results: results.sort(() => Math.random() - 0.5),
    widgets
  };
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

    const intents = detectIntents(prompt);
    const searchPromise = fetchSearchResults(prompt, intents);

    const ai = new GoogleGenAI({ apiKey });
    
    let systemPrompt = `You are a helpful AI search assistant. 
Provide a clear, concise, and highly accurate summary or answer to the user's query.
Format your response in Markdown. Do not include HTML tags.`;

    if (intents.math) {
        systemPrompt = `You are an expert mathematician and calculator. The user is asking a math question. Provide the final numerical answer clearly at the very top in a large heading (e.g., # Answer: 42), followed by a brief step-by-step explanation or formula.`;
    } else if (intents.code) {
        systemPrompt = `You are an expert software engineer. The user is asking a programming question. Provide the answer with clear, well-commented code blocks and a brief explanation of how it works.`;
    }

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
               temperature: 0.5
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

    const searchData = await searchPromise;
    const results = searchData.results;
    const widgets = searchData.widgets;

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

    <!-- Widgets Section -->
    ${widgets.weather ? `
      <div class="mb-6 bg-gradient-to-br from-blue-900 to-cyan-900 rounded-2xl p-6 shadow-xl border border-blue-800">
         <div class="flex items-center justify-between">
           <div>
             <h3 class="text-4xl font-bold text-white">${widgets.weather.temp}°C</h3>
             <p class="text-blue-200 text-lg mt-1">${widgets.weather.location}</p>
           </div>
           <div class="text-right">
             <p class="text-2xl font-medium text-white capitalize">${widgets.weather.desc}</p>
             <p class="text-sm text-blue-300 mt-1">Feels like ${widgets.weather.feelsLike}°C</p>
           </div>
         </div>
      </div>
    ` : ''}

    ${widgets.dictionary ? `
      <div class="mb-6 bg-[#161616] rounded-2xl p-6 shadow-xl border border-neutral-800">
         <h3 class="text-3xl font-serif font-bold text-white mb-2">${widgets.dictionary.word}</h3>
         <p class="text-cyan-400 font-mono text-sm mb-5">${widgets.dictionary.phonetic || ''}</p>
         <div class="space-y-4">
           ${widgets.dictionary.meanings.map((m: any) => `
             <div>
               <span class="text-xs font-bold uppercase tracking-wider text-neutral-500">${m.partOfSpeech}</span>
               <p class="text-neutral-300 mt-1">${m.definition}</p>
             </div>
           `).join('')}
         </div>
      </div>
    ` : ''}

    ${widgets.images && widgets.images.length > 0 ? `
      <div class="mb-6">
        <h3 class="text-lg font-medium text-neutral-200 mb-3 flex items-center"><svg class="w-5 h-5 mr-2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> Images</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          ${widgets.images.map((img: string) => `
            <a href="${img}" target="_blank" class="block rounded-lg overflow-hidden border border-neutral-800 hover:border-cyan-500 transition-colors">
              <img src="${img}" class="w-full aspect-video object-cover" alt="Search result image" loading="lazy" />
            </a>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${widgets.videos && widgets.videos.length > 0 ? `
      <div class="mb-6">
        <h3 class="text-lg font-medium text-neutral-200 mb-3 flex items-center"><svg class="w-5 h-5 mr-2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Videos</h3>
        <div class="grid grid-cols-2 gap-4">
          ${widgets.videos.map((vid: any) => `
            <a href="${vid.link}" target="_blank" class="block group">
              <div class="relative rounded-lg overflow-hidden border border-neutral-800 mb-2">
                <img src="${vid.thumbnail}" class="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300" alt="${vid.title}" loading="lazy" />
                <div class="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/10 transition-colors">
                   <div class="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                     <svg class="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>
                   </div>
                </div>
              </div>
              <h4 class="text-sm font-medium text-neutral-300 line-clamp-2 group-hover:text-cyan-400 transition-colors">${vid.title}</h4>
            </a>
          `).join('')}
        </div>
      </div>
    ` : ''}

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
      ${results.length > 0 ? results.map((r: any) => `
        <div class="group">
           <a href="${r.link}" target="_blank" class="block p-5 bg-[#111111] border border-neutral-800/50 hover:border-neutral-700 hover:bg-[#141414] rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
             <div class="flex items-center space-x-2 mb-2">
               <div class="w-5 h-5 rounded bg-neutral-800 flex items-center justify-center">
                 <svg class="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
               </div>
               <p class="text-xs text-neutral-400 font-medium truncate">${r.source} • ${new URL(r.link.startsWith('http') ? r.link : 'https://'+r.link).hostname.replace('www.','')}</p>
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

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000;
  setupVite().then(() => {
    app.listen(PORT, '0.0.0.0' as any, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

export default app;
