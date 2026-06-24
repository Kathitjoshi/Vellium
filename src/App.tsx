import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Loader2, Globe, Shield, Terminal, Settings,
  ChevronLeft, ChevronRight, RotateCw, Bookmark, Menu,
  Plus, History as HistoryIcon, Home, ExternalLink, Moon,
  Star, Lock, BookOpen, Download, HelpCircle
} from 'lucide-react';

interface HistoryEntry {
  prompt: string;
  html: string;
}

interface BookmarkEntry {
  prompt: string;
  timestamp: number;
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('vellium_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentIndex, setCurrentIndex] = useState(() => {
    try {
      const saved = localStorage.getItem('vellium_current_index');
      return saved ? parseInt(saved, 10) : -1;
    } catch {
      return -1;
    }
  });

  const [inputVal, setInputVal] = useState(() => {
    try {
      const savedHistory = localStorage.getItem('vellium_history');
      const savedIndex = localStorage.getItem('vellium_current_index');
      if (savedHistory && savedIndex) {
        const hist = JSON.parse(savedHistory);
        const idx = parseInt(savedIndex, 10);
        if (idx >= 0 && hist[idx]) return hist[idx].prompt;
      }
    } catch {
      // ignore
    }
    return '';
  });
  
  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>(() => {
    try {
      const saved = localStorage.getItem('vellium_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Menu and modal states
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [showSecurity, setShowSecurity] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('privacy');
  const [aiSystemPrompt, setAiSystemPrompt] = useState("You are a helpful AI search assistant. Provide a clear, concise, and highly accurate summary or answer to the user's query.");
  const [homeBgUrl, setHomeBgUrl] = useState(`https://picsum.photos/1920/1080?random=${Date.now()}`);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Persist history when changed
  useEffect(() => {
    try {
      localStorage.setItem('vellium_history', JSON.stringify(history));
    } catch (e) {
      // LocalStorage quota might be exceeded due to HTML size, truncate if needed
      console.error("Failed to save history to localStorage", e);
      try {
        localStorage.setItem('vellium_history', JSON.stringify(history.slice(-10)));
      } catch (e2) {
        // ignore
      }
    }
  }, [history]);

  // Persist currentIndex when changed
  useEffect(() => {
    localStorage.setItem('vellium_current_index', currentIndex.toString());
  }, [currentIndex]);

  // Save bookmarks when changed
  useEffect(() => {
    localStorage.setItem('vellium_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  const currentEntry = currentIndex >= 0 ? history[currentIndex] : null;
  const isBookmarked = currentEntry ? bookmarks.some(b => b.prompt === currentEntry.prompt) : false;

  const handleGenerate = async (promptToUse: string) => {
    if (!promptToUse.trim()) return;
    
    setLoading(true);
    setInputVal(promptToUse);
    setIsMenuOpen(false);
    setShowBookmarks(false);
    setShowHistory(false);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToUse, systemPrompt: aiSystemPrompt })
      });
      const data = await response.json();
      
      let newHtml = '';
      if (data.html) {
        newHtml = data.html;
      } else {
        newHtml = `<div style="color:red; font-family:monospace; padding: 20px; background: #000; height: 100vh;">[SYS_ERR]: ${data.error || 'Failed to initialize sequence.'}</div>`;
      }
      
      const newEntry = { prompt: promptToUse, html: newHtml };
      const baseHistory = currentIndex === -1 ? history : history.slice(0, currentIndex + 1);
      const newHistory = baseHistory.filter(e => e.prompt !== newEntry.prompt);
      newHistory.push(newEntry);
      
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
    } catch (err) {
       const errHtml = `<div style="color:red; font-family:monospace; padding: 20px; background: #000; height: 100vh;">[SYS_ERR]: Network anomalous. Generation failed.</div>`;
       const newEntry = { prompt: promptToUse, html: errHtml };
       const baseHistory = currentIndex === -1 ? history : history.slice(0, currentIndex + 1);
       const newHistory = baseHistory.filter(e => e.prompt !== newEntry.prompt);
       newHistory.push(newEntry);
       setHistory(newHistory);
       setCurrentIndex(newHistory.length - 1);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleGenerate(inputVal);
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setInputVal(history[currentIndex - 1].prompt);
    } else if (currentIndex === 0) {
      setCurrentIndex(-1);
      setInputVal('');
    }
  };

  const goForward = () => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setInputVal(history[currentIndex + 1].prompt);
    }
  };

  const reload = () => {
    if (currentEntry) {
      handleGenerate(currentEntry.prompt);
    }
  };

  const goHome = () => {
    setCurrentIndex(-1);
    setInputVal('');
    setShowBookmarks(false);
    setShowHistory(false);
    setHomeBgUrl(`https://picsum.photos/1920/1080?random=${Date.now()}`);
  };

  const toggleBookmark = () => {
    if (!currentEntry) return;
    if (isBookmarked) {
      setBookmarks(bookmarks.filter(b => b.prompt !== currentEntry.prompt));
    } else {
      setBookmarks([{ prompt: currentEntry.prompt, timestamp: Date.now() }, ...bookmarks.filter(b => b.prompt !== currentEntry.prompt)]);
    }
  };

  const openUrl = (prompt: string) => {
    setInputVal(prompt);
    handleGenerate(prompt);
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-cyan-500/30 overflow-hidden relative">
      {/* Top Chrome / Address Bar */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-cyan-900/30 shadow-[0_0_20px_rgba(6,182,212,0.05)] relative z-30 space-x-4"
      >
        <div className="flex items-center space-x-4">
          <div 
            onClick={goHome} 
            className="flex items-center space-x-2 text-cyan-400 cursor-pointer hover:text-cyan-300 transition-colors px-2 py-1 rounded hover:bg-cyan-900/20"
          >
            <Globe className="w-5 h-5" />
            <span className="font-bold tracking-widest text-sm uppercase hidden sm:block">Vellium</span>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center space-x-1">
            <button 
              onClick={goBack} 
              disabled={currentIndex < 0}
              className={`p-2 rounded-md transition-colors ${currentIndex < 0 ? 'text-neutral-600 cursor-not-allowed' : 'text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800'}`}
              title="Click to go back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={goForward} 
              disabled={currentIndex >= history.length - 1}
              className={`p-2 rounded-md transition-colors ${currentIndex >= history.length - 1 ? 'text-neutral-600 cursor-not-allowed' : 'text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800'}`}
              title="Click to go forward"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button 
              onClick={reload} 
              disabled={!currentEntry}
              className={`p-2 rounded-md transition-colors ${!currentEntry ? 'text-neutral-600 cursor-not-allowed' : 'text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800'}`}
              title="Reload page"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* URL Bar */}
        <form onSubmit={onSubmit} className="flex-1 max-w-3xl relative group flex items-center">
          <div className="w-full relative flex items-center bg-neutral-950/50 border border-neutral-800 group-hover:border-cyan-900/50 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50 rounded-full transition-all">
            <div className="pl-4 pr-2 text-cyan-600">
              {currentEntry ? <Lock className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5 text-neutral-500" />}
            </div>
            <input
               type="text"
               value={inputVal}
               onChange={e => setInputVal(e.target.value)}
               placeholder="Enter operational parameters or web coordinates..."
               className="w-full bg-transparent py-2 px-2 text-sm text-cyan-100 placeholder:text-neutral-600 focus:outline-none font-mono"
               disabled={loading}
            />
            {loading ? (
               <div className="pr-4">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
               </div>
            ) : (
              currentEntry && (
                <button 
                  type="button" 
                  onClick={toggleBookmark}
                  className="pr-4 pl-2 text-neutral-500 hover:text-cyan-400 transition-colors"
                  title="Bookmark this page"
                >
                  <Star className={`w-4 h-4 ${isBookmarked ? 'fill-cyan-400 text-cyan-400' : ''}`} />
                </button>
              )
            )}
          </div>
        </form>

        {/* Extensions / Menu */}
        <div className="flex items-center space-x-2">
           <button onClick={() => setShowSecurity(true)} className="p-2 text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800 rounded-md transition-colors hidden sm:block" title="Security Details">
             <Shield className="w-4 h-4" />
           </button>
           <button onClick={() => setShowDevTools(true)} className="p-2 text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800 rounded-md transition-colors hidden sm:block" title="Developer Tools">
             <Terminal className="w-4 h-4" />
           </button>
           <div className="relative">
             <button 
               onClick={() => setIsMenuOpen(!isMenuOpen)}
               className={`p-2 rounded-md transition-colors ${isMenuOpen ? 'bg-cyan-900/30 text-cyan-400' : 'text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800'}`}
             >
               <Menu className="w-5 h-5" />
             </button>

             <AnimatePresence>
               {isMenuOpen && (
                 <>
                   <div 
                     className="fixed inset-0 z-40" 
                     onClick={() => setIsMenuOpen(false)}
                   />
                   <motion.div
                     initial={{ opacity: 0, y: 10, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 10, scale: 0.95 }}
                     transition={{ duration: 0.15 }}
                     className="absolute right-0 top-full mt-2 w-64 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl z-50 overflow-hidden text-sm"
                   >
                     <div className="p-2 border-b border-neutral-800">
                        <button onClick={goHome} className="w-full flex items-center space-x-3 px-3 py-2 text-neutral-300 hover:bg-neutral-800 hover:text-cyan-400 rounded-md transition-colors">
                          <Plus className="w-4 h-4" />
                          <span>New Tab</span>
                        </button>
                        <button onClick={() => window.open(window.location.href, '_blank')} className="w-full flex items-center space-x-3 px-3 py-2 text-neutral-300 hover:bg-neutral-800 hover:text-cyan-400 rounded-md transition-colors">
                          <ExternalLink className="w-4 h-4" />
                          <span>New Window</span>
                        </button>
                     </div>
                     <div className="p-2 border-b border-neutral-800">
                        <button 
                          onClick={() => { setIsMenuOpen(false); setShowHistory(true); setShowBookmarks(false); }}
                          className="w-full flex items-center space-x-3 px-3 py-2 text-neutral-300 hover:bg-neutral-800 hover:text-cyan-400 rounded-md transition-colors"
                        >
                          <HistoryIcon className="w-4 h-4" />
                          <span>History</span>
                        </button>
                        <button 
                          onClick={() => { setIsMenuOpen(false); setShowBookmarks(true); setShowHistory(false); }}
                          className="w-full flex items-center space-x-3 px-3 py-2 text-neutral-300 hover:bg-neutral-800 hover:text-cyan-400 rounded-md transition-colors"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>Bookmarks and Lists</span>
                        </button>
                     </div>
                     <div className="p-2 border-b border-neutral-800">
                        <button onClick={() => { setIsMenuOpen(false); setShowDevTools(true); }} className="w-full flex items-center space-x-3 px-3 py-2 text-neutral-300 hover:bg-neutral-800 hover:text-cyan-400 rounded-md transition-colors">
                          <Terminal className="w-4 h-4" />
                          <span>View Page Source</span>
                        </button>
                     </div>
                     <div className="p-2 border-b border-neutral-800">
                        <button onClick={() => {
                          if (!currentEntry) return;
                          const blob = new Blob([currentEntry.html], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `vellium_${Date.now()}.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }} className="w-full flex items-center space-x-3 px-3 py-2 text-neutral-300 hover:bg-neutral-800 hover:text-cyan-400 rounded-md transition-colors">
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </button>
                        <button onClick={() => { setIsMenuOpen(false); setShowSettings(true); }} className="w-full flex items-center space-x-3 px-3 py-2 text-neutral-300 hover:bg-neutral-800 hover:text-cyan-400 rounded-md transition-colors">
                          <Settings className="w-4 h-4" />
                          <span>Settings</span>
                        </button>
                     </div>
                     <div className="p-2">
                        <button onClick={() => { setIsMenuOpen(false); setShowHelp(true); }} className="w-full flex items-center space-x-3 px-3 py-2 text-neutral-300 hover:bg-neutral-800 hover:text-cyan-400 rounded-md transition-colors">
                          <HelpCircle className="w-4 h-4" />
                          <span>Help</span>
                        </button>
                     </div>
                   </motion.div>
                 </>
               )}
             </AnimatePresence>
           </div>
        </div>
      </motion.header>

      {/* Main Viewport */}
      <main className="flex-1 relative bg-neutral-900 overflow-hidden">
        <AnimatePresence mode="wait">
          {loading ? (
             <motion.div
               key="loading"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-20 overflow-hidden"
             >
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                
                <div className="relative w-64 h-64 flex items-center justify-center mb-8">
                   <motion.div 
                     animate={{ rotate: 360 }}
                     transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                     className="absolute inset-0 rounded-full border border-cyan-500/20 border-t-cyan-400/80 border-r-cyan-400/80 shadow-[0_0_30px_rgba(34,211,238,0.2)]"
                   />
                   <motion.div 
                     animate={{ rotate: -360 }}
                     transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                     className="absolute inset-6 rounded-full border border-purple-500/20 border-b-purple-400/80 border-l-purple-400/80"
                   />
                   <div className="flex flex-col items-center space-y-4">
                     <div className="w-3 h-3 bg-cyan-400 rounded-full animate-ping shadow-[0_0_15px_rgba(34,211,238,1)]" />
                   </div>
                   <motion.div 
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]"
                   />
                </div>
                <h2 className="text-cyan-400 font-mono tracking-[0.3em] uppercase relative z-10 text-lg mb-2">Engaging Vellium Core</h2>
                <p className="text-cyan-800 font-mono text-xs max-w-sm text-center">Synthesizing parameters from matrix. Compiling requested coordinates into visual space...</p>
             </motion.div>
          ) : showHistory ? (
             <motion.div 
               key="history"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="absolute inset-0 bg-neutral-950 p-8 overflow-y-auto z-10"
             >
               <div className="max-w-4xl mx-auto">
                 <h2 className="text-2xl font-light text-cyan-400 mb-6 flex items-center space-x-3 border-b border-neutral-800 pb-4">
                   <HistoryIcon className="w-6 h-6" />
                   <span>Operational History</span>
                 </h2>
                 {history.length === 0 ? (
                   <p className="text-neutral-500 font-mono text-sm">No history recorded in this session.</p>
                 ) : (
                   <div className="space-y-2">
                      {[...history].reverse().map((entry, idx) => (
                        <div 
                          key={entry.prompt}
                          className="flex items-center space-x-4 p-4 bg-neutral-900/50 hover:bg-neutral-800 rounded-lg cursor-pointer border border-neutral-800 hover:border-cyan-900/50 transition-colors group"
                        >
                          <Globe className="w-5 h-5 text-neutral-600 group-hover:text-cyan-500" onClick={() => openUrl(entry.prompt)} />
                          <span className="flex-1 font-mono text-sm text-neutral-300 truncate" onClick={() => openUrl(entry.prompt)}>{entry.prompt}</span>
                          <button onClick={(e) => { e.stopPropagation(); setHistory(history.filter(h => h.prompt !== entry.prompt)); }} className="text-neutral-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                      ))}
                   </div>
                 )}
               </div>
             </motion.div>
          ) : showBookmarks ? (
             <motion.div 
               key="bookmarks"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="absolute inset-0 bg-neutral-950 p-8 overflow-y-auto z-10"
             >
               <div className="max-w-4xl mx-auto">
                 <h2 className="text-2xl font-light text-cyan-400 mb-6 flex items-center space-x-3 border-b border-neutral-800 pb-4">
                   <BookOpen className="w-6 h-6" />
                   <span>Saved Coordinates</span>
                 </h2>
                 {bookmarks.length === 0 ? (
                   <p className="text-neutral-500 font-mono text-sm">No coordinates saved.</p>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {bookmarks.map((b, idx) => (
                        <div 
                          key={b.prompt}
                          className="flex items-start space-x-4 p-5 bg-neutral-900/50 hover:bg-neutral-800 rounded-lg cursor-pointer border border-neutral-800 hover:border-cyan-900/50 transition-colors group"
                        >
                          <Star className="w-5 h-5 text-cyan-600 mt-0.5 group-hover:text-cyan-400 fill-cyan-900/30 group-hover:fill-cyan-500/20" onClick={() => openUrl(b.prompt)} />
                          <div className="flex-1 min-w-0" onClick={() => openUrl(b.prompt)}>
                            <p className="font-mono text-sm text-neutral-200 truncate">{b.prompt}</p>
                            <p className="text-xs text-neutral-600 mt-1">{new Date(b.timestamp).toLocaleString()}</p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setBookmarks(bookmarks.filter(bm => bm.prompt !== b.prompt)); }} className="text-neutral-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                      ))}
                   </div>
                 )}
               </div>
             </motion.div>
          ) : currentIndex < 0 ? (
             <motion.div 
               key="empty"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="absolute inset-0 flex flex-col items-center justify-center text-cyan-900 bg-neutral-950 overflow-hidden"
             >
               <div className="absolute inset-0 z-0">
                  <img src={homeBgUrl} alt="Wallpaper" className="w-full h-full object-cover opacity-30" />
                  <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm" />
               </div>
               <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:100px_100px] pointer-events-none z-0"></div>
               
               <div className="relative z-10 flex flex-col items-center">
                 <Globe className="w-24 h-24 mb-6 opacity-30 drop-shadow-[0_0_15px_rgba(8,145,178,0.3)] filter" />
                 <h1 className="text-2xl font-light tracking-[0.4em] uppercase mb-4 text-cyan-800">Vellium Engine</h1>
                 <div className="w-16 h-[1px] bg-cyan-900/50 mb-6"></div>
                 <p className="text-xs opacity-60 font-mono text-center max-w-md leading-loose">
                   READY FOR SEARCH QUERY.<br/>
                   TYPE YOUR QUESTION IN THE BAR ABOVE TO SEARCH THE WEB<br/>
                   AND GET AN AI SUMMARY.
                 </p>
               </div>

               {/* Quick Links for new tab */}
               <div className="mt-12 flex space-x-6 z-10">
                 {bookmarks.slice(0, 3).map((b, i) => (
                    <div
                      key={b.prompt}
                      className="relative w-32 p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-cyan-900/50 transition-all flex flex-col items-center group cursor-pointer"
                    >
                      <button onClick={(e) => { e.stopPropagation(); setBookmarks(bookmarks.filter(bm => bm.prompt !== b.prompt)); }} className="absolute top-1 right-1 text-neutral-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      <div onClick={() => openUrl(b.prompt)} className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center mb-3 group-hover:bg-cyan-900/20 transition-colors">
                        <Star className="w-4 h-4 text-cyan-600 group-hover:text-cyan-400 fill-cyan-900/50" />
                      </div>
                      <span onClick={() => openUrl(b.prompt)} className="text-xs text-neutral-400 font-mono truncate w-full text-center group-hover:text-cyan-400">{b.prompt}</span>
                    </div>
                 ))}
               </div>
             </motion.div>
          ) : (
             <div key="content" className="absolute inset-0 bg-white overflow-hidden">
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ duration: 0.5 }}
                 className="w-full h-full"
               >
                 <iframe
                   ref={iframeRef}
                   srcDoc={currentEntry?.html || ''}
                   sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                   className="border-none bg-white origin-top-left"
                   style={{
                     width: '100%',
                     height: '100%'
                   }}
                   title="Vellium Rendered View"
                 />
               </motion.div>
             </div>
          )}
        </AnimatePresence>

        {/* Modals */}
        <AnimatePresence>
          {showSecurity && (
             <motion.div 
               key="securityModal"
               initial={{ opacity: 0, y: -20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="absolute top-16 right-4 w-72 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl p-4 z-50 text-sm"
             >
               <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center space-x-2 text-cyan-400">
                   <Shield className="w-5 h-5" />
                   <span className="font-medium">Connection is secure</span>
                 </div>
                 <button onClick={() => setShowSecurity(false)} className="text-neutral-500 hover:text-neutral-300">✕</button>
               </div>
               <p className="text-neutral-400 font-mono text-xs">Your operational sequence with Vellium is encrypted and synthesized locally within the matrix frame.</p>
             </motion.div>
          )}

          {showDevTools && (
             <motion.div 
               key="devToolsModal"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className="absolute top-14 bottom-0 right-0 w-1/3 bg-neutral-950 border-l border-neutral-800 shadow-2xl z-40 flex flex-col"
             >
               <div className="p-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900">
                 <span className="text-cyan-400 font-mono text-sm uppercase tracking-widest">Developer Console</span>
                 <button onClick={() => setShowDevTools(false)} className="text-neutral-500 hover:text-neutral-300">✕</button>
               </div>
               <div className="flex-1 p-4 overflow-auto">
                 {currentEntry ? (
                   <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap">
                     {currentEntry.html}
                   </pre>
                 ) : (
                   <div className="text-neutral-500 font-mono text-xs">No active DOM loaded.</div>
                 )}
               </div>
             </motion.div>
          )}

          {showSettings && (
             <motion.div 
               key="settingsModal"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
             >
               <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex overflow-hidden flex-col md:flex-row">
                 {/* Sidebar */}
                 <div className="w-full md:w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col">
                   <div className="p-4 flex items-center justify-between border-b border-neutral-800">
                     <h2 className="text-lg font-light text-cyan-400 tracking-wider uppercase flex items-center space-x-2">
                       <Settings className="w-5 h-5" />
                       <span>Settings</span>
                     </h2>
                     <button onClick={() => setShowSettings(false)} className="text-neutral-500 hover:text-neutral-300 md:hidden">✕</button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-1 text-sm font-medium">
                     <div onClick={() => setActiveSettingsTab('privacy')} className={`px-3 py-2 rounded-md cursor-pointer flex justify-between items-center ${activeSettingsTab === 'privacy' ? 'text-cyan-400 bg-neutral-900/50' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'}`}>
                       <span>Privacy and security</span>
                       {activeSettingsTab === 'privacy' && <Shield className="w-4 h-4 opacity-50" />}
                     </div>
                     <div onClick={() => setActiveSettingsTab('engine')} className={`px-3 py-2 rounded-md cursor-pointer flex justify-between items-center ${activeSettingsTab === 'engine' ? 'text-cyan-400 bg-neutral-900/50' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'}`}>
                       <span>AI Engine</span>
                       {activeSettingsTab === 'engine' && <Terminal className="w-4 h-4 opacity-50" />}
                     </div>
                     <div onClick={() => setActiveSettingsTab('advanced')} className={`px-3 py-2 rounded-md cursor-pointer flex justify-between items-center ${activeSettingsTab === 'advanced' ? 'text-cyan-400 bg-neutral-900/50' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'}`}>
                       <span>Advanced Options</span>
                       {activeSettingsTab === 'advanced' && <Terminal className="w-4 h-4 opacity-50" />}
                     </div>
                   </div>
                 </div>
                 {/* Content */}
                 <div className="flex-1 p-6 md:p-10 overflow-y-auto relative">
                   <button onClick={() => setShowSettings(false)} className="absolute top-6 right-6 text-neutral-500 hover:text-neutral-300 hidden md:block">✕</button>
                   
                   <div className="max-w-2xl">
                     <h3 className="text-xl text-neutral-200 font-light mb-6 flex items-center space-x-3">
                       <Shield className="w-6 h-6 text-cyan-500" />
                       <span>Privacy and security</span>
                     </h3>
                     
                     <div className="space-y-4">
                        {activeSettingsTab === 'privacy' && (
                          <div className="p-5 bg-neutral-950/50 rounded-xl border border-neutral-800/80 hover:border-neutral-700 transition-colors">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-medium text-neutral-200 flex items-center space-x-2">
                                  <span>Clear browsing data</span>
                                </div>
                                <div className="text-sm text-neutral-500 mt-1">Clear history, bookmarks, and cache</div>
                              </div>
                              <button 
                                onClick={() => { setHistory([]); setBookmarks([]); setCurrentIndex(-1); setShowSettings(false); }}
                                className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-sm font-medium border border-red-500/20"
                              >
                                Clear Data
                              </button>
                            </div>
                          </div>
                        )}
                                         {activeSettingsTab === 'engine' && (
                          <div className="p-5 bg-neutral-950/50 rounded-xl border border-neutral-800/80 hover:border-neutral-700 transition-colors">
                            <div className="flex flex-col space-y-2">
                              <div>
                                <div className="font-medium text-neutral-200">AI System Prompt</div>
                                <div className="text-sm text-neutral-500 mt-1">Configure the core instructions used to generate pages.</div>
                              </div>
                              <textarea 
                                value={aiSystemPrompt}
                                onChange={(e) => setAiSystemPrompt(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 px-4 py-3 rounded-lg focus:outline-none focus:border-cyan-500/50 mt-2 min-h-[100px]"
                                placeholder="Instructions..."
                              />
                            </div>
                          </div>
                        )}
                        
                        {activeSettingsTab === 'advanced' && (
                          <div className="p-5 bg-neutral-950/50 rounded-xl border border-neutral-800/80 hover:border-neutral-700 transition-colors">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-medium text-neutral-200">Developer Console</div>
                                <div className="text-sm text-neutral-500 mt-1">View the raw HTML source of the currently loaded page</div>
                              </div>
                              <button 
                                onClick={() => { setShowSettings(false); setShowDevTools(true); }}
                                className="px-4 py-2 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors text-sm font-medium"
                              >
                                Open
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
          )}

          {showHelp && (
            <motion.div 
               key="helpModal"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
             >
               <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
                 <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300">✕</button>
                 <h2 className="text-xl font-light text-cyan-400 mb-4 flex items-center space-x-2">
                   <HelpCircle className="w-5 h-5" />
                   <span>Vellium Browser Help</span>
                 </h2>
                 <div className="text-neutral-300 space-y-3 text-sm leading-relaxed">
                   <p>Welcome to Vellium Engine.</p>
                   <p><strong>1. Search:</strong> Type your query in the address bar to search the web and get an AI summary.</p>
                   <p><strong>2. Bookmarks:</strong> Use the star icon to save searches to your quick access links.</p>
                   <p><strong>3. History:</strong> View your operational history and easily reload searches.</p>
                   <p><strong>4. Developer Console:</strong> Use settings to inspect the raw output of the AI generations.</p>
                   <p className="mt-4 pt-4 border-t border-neutral-800 font-mono text-cyan-600/80 text-xs">SYSTEM STATUS: NOMINAL</p>
                 </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

