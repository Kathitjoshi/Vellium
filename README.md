# Vellium Search Engine

## Overview
Vellium is a modern, AI-augmented search interface. Instead of just generating standard search results, Vellium queries multiple open APIs simultaneously, retrieves search results from diverse sources (such as Wikipedia, Dev.to, HackerNews, StackOverflow, and more), and concurrently prompts the Gemini 2.5 Flash model to generate a concise, highly accurate summary of the query. The application then dynamically constructs a responsive results page containing both the web links and the AI-generated summary, which is rendered securely within the main application window. Use [this](https://ollama.com/kathitjoshi/vellium) to understand more about the project

## Architecture
The project is built as a full-stack application leveraging modern web technologies:
- **Frontend**: React 18, TypeScript, and Vite. The user interface is styled with Tailwind CSS, utilizing framer-motion for smooth transitions and lucide-react for iconography. The application simulates a browser-like experience with a top navigation bar, bookmarks, and a history panel.
- **Backend**: Express.js server running on Node.js. During development, Vite is mounted as middleware for hot-module replacement and asset serving. In production, the server serves the statically built frontend from the `dist` directory.
- **Search Engine API Aggregator**: The backend uses standard fetch to concurrently query 8 different public APIs: Wikipedia, Dev.to, HackerNews, StackOverflow, Crossref, OpenLibrary, GitHub, and MDN Web Docs. This approach avoids bot-blocking issues typical of traditional search engine scraping.
- **AI Integration**: The backend utilizes the `@google/genai` SDK to interface with Gemini. The AI prompt is crafted to ensure the AI acts as a search assistant, returning a markdown-formatted summary.
- **Markdown Parsing**: The AI response is parsed into HTML on the server using `marked` and styled via Tailwind Typography.

## Data Flow
1. **User Input**: The user types a query into the Vellium search bar and hits Enter.
2. **API Request**: The React frontend sends a POST request to the `/api/generate` endpoint on the Express backend, containing the user's prompt.
3. **Concurrent Processing**:
   - The server concurrently fetches the search results from multiple open APIs and normalizes the data into a standard structure.
   - Simultaneously, the server sends the prompt to the Gemini API with system instructions to generate a markdown summary.
4. **Assembly**: The server compiles the AI summary (parsed to HTML via `marked`), contextually ranked web results, and dynamic widgets into a single, cohesive, self-contained HTML document styled with Tailwind CSS.
5. **Rendering**: The Express server returns this HTML document as a JSON response. The React frontend injects this HTML into an isolated iframe to display the results securely to the user.

## Features
- **Multimodal Intent Engine**: Analyzes user queries to detect specific intents like Weather (wttr.in), Dictionary Definitions (Dictionary API), Images (Wikimedia), Videos (Dailymotion), Audio/Music (iTunes API), Math (Math.js), Documents/Formats, or Brand websites (Clearbit Autocomplete), and injects customized rich UI widgets for those domains to save AI quotas.
- **Concurrent API Aggregation**: Parallelizes fetches across open public APIs (Wikipedia, StackOverflow, MDN, Dev.to) to ensure instant web search coverage, while dynamically activating Academic endpoints (Crossref, OpenLibrary) only for related subjects (history, science, etc.).
- **Contextual Ranking Engine**: Rather than randomizing results, the engine prioritizes sources based on the query intent (e.g., boosting MDN and StackOverflow for coding queries, and Wikipedia for history/science) and matches exact title keywords.
- **AI Search Summary**: Get immediate, AI-generated answers alongside traditional web results, automatically adapting to the user's intent (e.g., calculator or coding modes).
- **Bookmarks & History**: Save your favorite queries and review your past searches within the session.
- **Resilient AI Handling**: Includes fallback mechanisms and error handling for AI generation quota limits or service unavailability.

## Technical Notes
- **Datacenter Blocking Issue**: Almost all major cloud hosting platforms (Vercel, Render, AWS, Heroku, etc.) assign Datacenter IP addresses. Bot protection systems (like Cloudflare), which safeguard search engines like DuckDuckGo, Yahoo, and Google, indiscriminately block these datacenter IPs to prevent automated scraping. Switching from Vercel to Render, or using a headless browser (like Puppeteer) on those platforms, won't bypass this natively because the traffic still originates from a datacenter. To truly scrape those engines in production, you would need to route requests through Residential Proxy networks (e.g., BrightData, Oxylabs) which bypass datacenter blocks. To maintain a free, robust application, this app aggregates data from fully open developer APIs instead.

## Project Structure
```text
.
├── .env.example             # Template for environment variables
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions configuration for CI/CD
├── package.json             # Project dependencies and npm scripts
├── server.ts                # Express backend and API routes
├── src/
│   ├── App.tsx              # Main React application component
│   ├── index.css            # Global Tailwind CSS directives
│   ├── main.tsx             # React DOM entry point
│   └── vite-env.d.ts        # Vite type definitions
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite bundler configuration
```

## Local Development Setup

### Prerequisites
- Node.js (v20 or higher)
- A valid Gemini API Key

### Installation Steps
1. Clone the repository and navigate into the project directory.
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Create and edit the `.env` file and insert your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

## LICENSE

MIT License
