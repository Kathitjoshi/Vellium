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
    academic: /\b(science|physics|chemistry|biology|english|geography|computer|languages|culture|roman|empire|war)\b/i.test(query),
    audio: /\b(audio|music|song|mp3|podcast|sound|listen)\b/i.test(query),
    documents: /\b(pdf|doc|docx|ppt|pptx|xls|xlsx|csv|json|xml|format)\b/i.test(query),
    location: /\b(where is|location of|map of|city|country|capital|street)\b/i.test(query),
    finance: /\b(stock|price of|crypto|bitcoin|ethereum|coin|market|shares)\b/i.test(query),
    packages: /\b(npm|package|library|install|yarn|dependency)\b/i.test(query),
    medical: /\b(medical|medicine|health|disease|symptom|treatment|drug|cancer|virus|bacteria|syndrome|therapy|hospital|surgery|anatomy|physiology)\b/i.test(query),
    law: /\b(law|legal|court|attorney|lawyer|judge|sue|lawsuit|legislation|constitution|supreme court|justice|rights)\b/i.test(query),
    statistics: /\b(statistics|stats|data|demographics|population|gdp|rate|percentage|average|census)\b/i.test(query),
    sports: /\b(sports|football|basketball|soccer|baseball|tennis|olympics|nba|nfl|fifa|score|match|team|player)\b/i.test(query),
    movies: /\b(movie|film|tv show|cinema|director|actor|actress|oscars|netflix|hollywood|anime)\b/i.test(query),
    food: /\b(food|recipe|cooking|cook|meal|ingredient|restaurant|diet|nutrition|baking)\b/i.test(query),
    travel: /\b(travel|flight|hotel|tourism|vacation|trip|destination|resort|airline|airport)\b/i.test(query),
    art: /\b(art|painting|sculpture|artist|museum|gallery|exhibition|design|architecture)\b/i.test(query),
    gaming: /\b(game|gaming|nintendo|playstation|xbox|pc game|esports|console|gameplay|rpg|mmo)\b/i.test(query),
    astronomy: /\b(space|astronomy|planet|star|galaxy|universe|nasa|telescope|moon|mars)\b/i.test(query),
    psychology: /\b(psychology|mental|behavior|therapy|brain|mind|cognitive|emotion|trauma)\b/i.test(query),
    philosophy: /\b(philosophy|ethics|morality|logic|existential|truth|meaning of life)\b/i.test(query),
    religion: /\b(religion|god|bible|quran|torah|buddhism|hinduism|islam|christianity|church|temple|mosque)\b/i.test(query),
    engineering: /\b(engineering|mechanical|electrical|civil|aerospace|robotics|machine|manufacturing)\b/i.test(query),
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

  if (intents.academic) {
      fetchPromises.push(
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
          }).catch(e => console.error('Crossref error:', e))
      );
      
      fetchPromises.push(
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
          }).catch(e => console.error('OpenLibrary error:', e))
      );
  }

  if (intents.audio) {
      const audioQuery = query.replace(/\b(audio|music|song|mp3|podcast|sound|listen)\b/ig, '').trim() || query;
      fetchPromises.push(
          fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(audioQuery)}&limit=4&entity=song`)
          .then(r => r.json())
          .then(data => {
              if (data.results && data.results.length > 0) {
                  widgets.audio = data.results.map((v: any) => ({
                      title: v.trackName,
                      artist: v.artistName,
                      thumbnail: v.artworkUrl100,
                      preview: v.previewUrl,
                      link: v.trackViewUrl
                  }));
              }
          }).catch(e => console.error('Audio error:', e))
      );
  }

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

  if (intents.math) {
      let expr = query.replace(/^(?:calculate|calc|math)\s+/i, '').trim();
      expr = expr.replace(/square root of\s*(\d+(\.\d+)?)/i, 'sqrt($1)');
      fetchPromises.push(
          fetch(`https://api.mathjs.org/v4/?expr=${encodeURIComponent(expr)}`)
          .then(r => r.text())
          .then(data => {
              if (data && !data.startsWith('Error') && !data.includes('HTML')) {
                  widgets.math = {
                      expression: expr,
                      result: data
                  };
              }
          }).catch(e => console.error('Math error:', e))
      );
  }

  if (query.split(' ').length <= 3) {
      fetchPromises.push(
          fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`)
          .then(r => r.json())
          .then(data => {
              if (data && data.length > 0) {
                  const bestMatch = data.find((d:any) => d.name.toLowerCase() === query.toLowerCase()) || data[0];
                  if (bestMatch) {
                      widgets.website = bestMatch;
                  }
              }
          }).catch(e => console.error('Website autocomplete error:', e))
      );
  }

  if (intents.location) {
      const locQuery = query.replace(/\b(where is|location of|map of|city|country|capital|street)\b/ig, '').trim() || query;
      fetchPromises.push(
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locQuery)}&limit=1`)
          .then(r => r.json())
          .then(data => {
              if (data && data.length > 0) {
                  widgets.location = {
                      name: data[0].display_name,
                      lat: data[0].lat,
                      lon: data[0].lon
                  };
              }
          }).catch(e => console.error('Location error:', e))
      );
  }

  if (intents.finance) {
      const finQuery = query.replace(/\b(stock|price of|crypto|coin|market|shares)\b/ig, '').trim() || query;
      fetchPromises.push(
          fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(finQuery)}`)
          .then(r => r.json())
          .then(data => {
              if (data && data.coins && data.coins.length > 0) {
                  widgets.finance = data.coins.slice(0, 3).map((c: any) => ({
                      name: c.name,
                      symbol: c.symbol,
                      thumb: c.thumb,
                      rank: c.market_cap_rank
                  }));
              }
          }).catch(e => console.error('Finance error:', e))
      );
  }

  if (intents.packages) {
      const pkgQuery = query.replace(/\b(npm|package|library|install|yarn|dependency)\b/ig, '').trim() || query;
      fetchPromises.push(
          fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(pkgQuery)}&size=3`)
          .then(r => r.json())
          .then(data => {
              if (data && data.objects && data.objects.length > 0) {
                  widgets.packages = data.objects.map((o: any) => ({
                      name: o.package.name,
                      version: o.package.version,
                      description: o.package.description,
                      link: o.package.links.npm
                  }));
              }
          }).catch(e => console.error('Packages error:', e))
      );
  }

  if (intents.medical) {
      fetchPromises.push(
          fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${qEncode}&format=json&resultType=lite`)
          .then(res => res.json())
          .then(data => {
            if (data.resultList && data.resultList.result) {
                data.resultList.result.slice(0, 5).forEach((item: any) => {
                    results.push({
                        title: item.title,
                        link: `https://europepmc.org/article/MED/${item.pmid}`,
                        snippet: item.abstractText ? item.abstractText.replace(/<[^>]*>?/gm, '').substring(0, 200) : 'Medical Research Article',
                        source: 'EuropePMC'
                    });
                });
            }
          }).catch(e => console.error('EuropePMC error:', e))
      );
  }

  if (intents.movies) {
      const movieQuery = query.replace(/\b(movie|film|tv show|cinema|anime)\b/ig, '').trim() || query;
      fetchPromises.push(
          fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(movieQuery)}`)
          .then(res => res.json())
          .then(data => {
              if (data && data.length > 0) {
                  data.slice(0, 3).forEach((d: any) => {
                      results.push({
                          title: d.show.name,
                          link: d.show.url,
                          snippet: (d.show.summary || '').replace(/<[^>]*>?/gm, '').substring(0, 200) + ` (Genres: ${d.show.genres?.join(', ')})`,
                          source: 'TVMaze'
                      });
                  });
              }
          }).catch(e => console.error('TVMaze error:', e))
      );
  }

  if (intents.food) {
      const foodQuery = query.replace(/\b(food|recipe|cooking|cook|meal)\b/ig, '').trim() || query;
      fetchPromises.push(
          fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(foodQuery)}`)
          .then(res => res.json())
          .then(data => {
              if (data && data.meals && data.meals.length > 0) {
                  data.meals.slice(0, 3).forEach((m: any) => {
                      results.push({
                          title: m.strMeal,
                          link: m.strSource || m.strYoutube || '#',
                          snippet: `Category: ${m.strCategory}. Area: ${m.strArea}. Instructions: ${m.strInstructions?.substring(0, 150)}...`,
                          source: 'TheMealDB'
                      });
                  });
              }
          }).catch(e => console.error('MealDB error:', e))
      );
  }

  if (intents.art) {
      const artQuery = query.replace(/\b(art|painting|sculpture|artist)\b/ig, '').trim() || query;
      fetchPromises.push(
          fetch(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(artQuery)}&limit=3&fields=title,artist_title,description`)
          .then(res => res.json())
          .then(data => {
              if (data && data.data && data.data.length > 0) {
                  data.data.forEach((a: any) => {
                      results.push({
                          title: a.title,
                          link: `https://www.artic.edu/artworks/${a.id}`,
                          snippet: `Artist: ${a.artist_title || 'Unknown'}. ${(a.description || '').replace(/<[^>]*>?/gm, '').substring(0, 150)}`,
                          source: 'Art Institute'
                      });
                  });
              }
          }).catch(e => console.error('Art error:', e))
      );
  }

  await Promise.allSettled(fetchPromises);
  
  return {
    results: results.sort((a, b) => {
      const score = (r: any) => {
         let s = 0;
         const source = r.source;
         if (source === 'Tavily Search' || source === 'Document Parser') return 100;
         if (intents.code) {
             if (source === 'MDN Web Docs') s = 100;
             else if (source === 'StackOverflow') s = 90;
             else if (source === 'GitHub') s = 80;
             else if (source === 'Dev.to') s = 70;
             else if (source === 'Wikipedia') s = 60;
             else if (source === 'HackerNews') s = 50;
         } else if (intents.academic) {
             if (source === 'Crossref') s = 100;
             else if (source === 'OpenLibrary') s = 90;
             else if (source === 'Wikipedia') s = 80;
         } else {
             if (source === 'Wikipedia') s = 100;
             else if (source === 'MDN Web Docs') s = 20;
             else if (source === 'Dev.to') s = 20;
             else if (source === 'HackerNews') s = 30;
             else s = 10;
         }
         
         const titleLower = r.title.toLowerCase();
         const snippetLower = r.snippet.toLowerCase();
         const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
         
         let matchScore = 0;
         qWords.forEach(w => {
            if (titleLower.includes(w)) matchScore += 30;
            if (snippetLower.includes(w)) matchScore += 10;
         });
         s += matchScore;
         
         if (titleLower.includes(query.toLowerCase())) {
             s += 100;
         }
         return s;
      };
      return score(b) - score(a);
    }).filter((r, i, arr) => {
      // Filter out low relevance generic results if we have good ones
      const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const titleLower = r.title.toLowerCase();
      const snippetLower = r.snippet.toLowerCase();
      const hasMatch = qWords.some(w => titleLower.includes(w) || snippetLower.includes(w));
      return hasMatch || i < 3; // Keep at least top 3 if no exact word matches
    }),
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
    
    const searchData = await searchPromise;
    const results = searchData.results;
    const widgets = searchData.widgets;

    const contextSnippets = results.slice(0, 5).map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n');

    const ai = new GoogleGenAI({ apiKey });
    
    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentTime = new Date().toLocaleTimeString('en-US');

    let systemPrompt = `You are a helpful AI search assistant. 
The current date is ${currentDate} and the current time is ${currentTime}. Always take this current date and time into account when the user asks about recent events, "next month", "today", "this year", "now", etc.
Here is some real-time web context that might help answer the user (incorporate this into your answer if relevant):
${contextSnippets}
Provide a clear, concise, and highly accurate summary or answer to the user's query.
Format your response in Markdown. Do not include HTML tags.
At the very end of your response, on a new line, you MUST provide exactly 3 related follow-up search queries separated by the pipe character like this:
RELATED: query 1 | query 2 | query 3`;

    if (intents.math) {
        systemPrompt = `You are an expert mathematician and calculator. The user is asking a math question. Provide the final numerical answer clearly at the very top in a large heading (e.g., # Answer: 42), followed by a brief step-by-step explanation or formula.\nAt the very end of your response, on a new line, provide exactly 3 related queries like this:\nRELATED: query 1 | query 2 | query 3`;
    } else if (intents.code) {
        systemPrompt = `You are an expert software engineer. The user is asking a programming question. Provide the answer with clear, well-commented code blocks and a brief explanation of how it works. You MUST wrap all code in Markdown code blocks.\nAt the very end of your response, on a new line, provide exactly 3 related queries like this:\nRELATED: query 1 | query 2 | query 3`;
    } else if (intents.documents) {
        systemPrompt = `You are a data and document formatting expert. The user is asking about a specific document format (PDF, JSON, CSV, XML, etc.). Provide a clear structural example or explain how to parse/generate that format efficiently.\nAt the very end of your response, on a new line, provide exactly 3 related queries like this:\nRELATED: query 1 | query 2 | query 3`;
    }

    let aiAnswerMarkdown = '';
    let aiError = '';
    let relatedQueries: string[] = [];

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
      
      const relatedMatch = aiAnswerMarkdown.match(/RELATED:\s*(.*)/i);
      if (relatedMatch) {
         relatedQueries = relatedMatch[1].split('|').map((q: string) => q.trim()).filter(Boolean);
         aiAnswerMarkdown = aiAnswerMarkdown.replace(/RELATED:\s*(.*)/i, '').trim();
      }
    } catch (error: any) {
      let errorMessage = error?.message || 'Failed to generate content.';
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        aiError = '[SYS_ERR]: AI generation quota exceeded. Please try again later or check your API key billing details.';
      } else {
        aiError = `[SYS_ERR]: AI generation failed: ${errorMessage}`;
      }
      console.error('Error generating AI answer:', error);
    }

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
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script>document.addEventListener('DOMContentLoaded', (event) => { hljs.highlightAll(); });</script>
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
  <div id="aiAnswerExport" data-md="${encodeURIComponent(aiAnswerMarkdown)}" style="display:none;"></div>
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
      
      ${relatedQueries.length > 0 ? `
      <div class="mt-8 border-t border-neutral-800/80 pt-6">
        <h4 class="text-xs font-bold text-neutral-500 mb-4 uppercase tracking-widest">People also ask</h4>
        <div class="flex flex-wrap gap-2">
          ${relatedQueries.map(q => `
             <div class="px-4 py-2 bg-neutral-900 border border-neutral-800 text-cyan-200 rounded-full text-sm flex items-center shrink-0 shadow-sm">
                <svg class="w-3.5 h-3.5 mr-2 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                ${q}
             </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>

    <!-- Widgets Section -->
    ${widgets.location ? `
      <div class="mb-6 bg-[#161616] rounded-2xl p-6 shadow-xl border border-neutral-800">
         <div class="flex items-start space-x-4">
            <div class="w-12 h-12 rounded bg-neutral-800 flex items-center justify-center shrink-0">
               <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </div>
            <div>
               <h3 class="text-xl font-bold text-white mb-1">Map Location</h3>
               <p class="text-neutral-300 text-sm mb-3">${widgets.location.name}</p>
               <div class="flex space-x-3">
                  <a href="https://www.openstreetmap.org/?mlat=${widgets.location.lat}&mlon=${widgets.location.lon}#map=12/${widgets.location.lat}/${widgets.location.lon}" target="_blank" class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors">View on OpenStreetMap</a>
               </div>
            </div>
         </div>
      </div>
    ` : ''}

    ${widgets.finance ? `
      <div class="mb-6 bg-[#161616] rounded-2xl p-6 shadow-xl border border-neutral-800">
         <h3 class="text-lg font-medium text-neutral-200 mb-4 flex items-center"><svg class="w-5 h-5 mr-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Finance & Crypto</h3>
         <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            ${widgets.finance.map((c: any) => `
              <div class="bg-neutral-900 rounded-xl p-4 border border-neutral-800 flex items-center space-x-3">
                 <img src="${c.thumb}" class="w-10 h-10 rounded-full bg-white object-contain" alt="${c.name}">
                 <div>
                    <h4 class="text-white font-medium">${c.name}</h4>
                    <p class="text-neutral-400 text-xs uppercase">${c.symbol} • Rank #${c.rank || 'N/A'}</p>
                 </div>
              </div>
            `).join('')}
         </div>
      </div>
    ` : ''}

    ${widgets.packages ? `
      <div class="mb-6 bg-[#161616] rounded-2xl p-6 shadow-xl border border-neutral-800">
         <h3 class="text-lg font-medium text-neutral-200 mb-4 flex items-center"><svg class="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg> NPM Packages</h3>
         <div class="space-y-3">
            ${widgets.packages.map((pkg: any) => `
              <div class="bg-neutral-900 rounded-xl p-4 border border-neutral-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                 <div>
                    <a href="${pkg.link}" target="_blank" class="text-cyan-400 font-bold hover:underline text-lg">${pkg.name}</a>
                    <span class="text-xs text-neutral-500 ml-2 border border-neutral-700 px-2 py-0.5 rounded-full">v${pkg.version}</span>
                    <p class="text-neutral-400 text-sm mt-1">${pkg.description || 'No description available'}</p>
                 </div>
                 <div class="bg-black border border-neutral-800 rounded px-3 py-1.5 font-mono text-sm text-neutral-300 shrink-0">
                    npm i ${pkg.name}
                 </div>
              </div>
            `).join('')}
         </div>
      </div>
    ` : ''}

    ${widgets.audio ? `
      <div class="mb-6">
        <h3 class="text-lg font-medium text-neutral-200 mb-3 flex items-center"><svg class="w-5 h-5 mr-2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg> Audio & Music</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${widgets.audio.map((track: any) => `
            <div class="bg-[#161616] rounded-xl p-4 flex items-center space-x-4 border border-neutral-800">
               <img src="${track.thumbnail}" class="w-16 h-16 rounded-md shadow-md" alt="${track.title}">
               <div class="flex-1 min-w-0">
                  <h4 class="text-white font-medium truncate">${track.title}</h4>
                  <p class="text-neutral-400 text-sm truncate">${track.artist}</p>
                  <audio controls class="w-full h-8 mt-2 opacity-80" src="${track.preview}"></audio>
               </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

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

    ${widgets.website ? `
      <div class="mb-6 bg-[#161616] rounded-2xl p-6 shadow-xl border border-neutral-800 flex items-center space-x-4">
         ${widgets.website.logo ? `<img src="${widgets.website.logo}" class="w-12 h-12 rounded bg-white p-1" alt="Logo">` : `<div class="w-12 h-12 rounded bg-neutral-800 flex items-center justify-center"><svg class="w-6 h-6 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg></div>`}
         <div>
            <h3 class="text-xl font-bold text-white">${widgets.website.name}</h3>
            <a href="https://${widgets.website.domain}" target="_blank" class="text-cyan-400 text-sm hover:underline">${widgets.website.domain}</a>
         </div>
      </div>
    ` : ''}

    ${widgets.math ? `
      <div class="mb-6 bg-[#111111] rounded-2xl p-6 shadow-xl border border-neutral-800 font-mono">
         <p class="text-neutral-400 text-sm mb-2">${widgets.math.expression} =</p>
         <h3 class="text-4xl font-bold text-cyan-400">${widgets.math.result}</h3>
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
               <img src="https://s2.googleusercontent.com/s2/favicons?sz=64&domain_url=${new URL(r.link.startsWith('http') ? r.link : 'https://'+r.link).origin}" class="w-5 h-5 rounded bg-neutral-800 p-0.5 object-contain" alt="Favicon">
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

    res.json({ html: htmlTemplate, aiAnswerMarkdown });
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
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  setupVite().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

export default app;
