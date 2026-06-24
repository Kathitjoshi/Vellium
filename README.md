# Vellium Search Engine

## Overview
Vellium is a modern, AI-augmented search interface. Instead of just generating standard search results, Vellium queries multiple open APIs simultaneously, retrieves search results from diverse sources (such as Wikipedia, Dev.to, HackerNews, StackOverflow, and more), and concurrently prompts the Gemini 2.5 Flash model to generate a concise, highly accurate summary of the query. The application then dynamically constructs a responsive results page containing both the web links and the AI-generated summary, which is rendered securely within the main application window.

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
4. **Assembly**: The server compiles the AI summary (parsed to HTML via `marked`) and the randomized mixed web results into a single, cohesive, self-contained HTML document styled with Tailwind CSS.
5. **Rendering**: The Express server returns this HTML document as a JSON response. The React frontend injects this HTML into an isolated iframe to display the results securely to the user.

## Features
- **AI Search Summary**: Get immediate, AI-generated answers alongside traditional web results.
- **Web Results Integration**: Extracts up to 50 relevant search results directly from the web.
- **Bookmarks & History**: Save your favorite queries and review your past searches within the session.
- **Customizable Interface**: Access the settings panel to tweak privacy options and appearance.
- **Resilient AI Handling**: Includes fallback mechanisms and error handling for AI generation quota limits or service unavailability.

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
3. Create a `.env` file in the root directory based on the provided example:
   ```bash
   cp .env.example .env
   ```
4. Edit the `.env` file and insert your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

## LICENSE

MIT License
