# ApiCortex Frontend

This is the frontend dashboard for **ApiCortex**, a developer-focused SaaS platform for API failure prediction, API contract testing, and API telemetry tracking.

## Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4, custom theme
- **Components**: shadcn/ui
- **Icons**: Lucide React
- **State & Data Fetching**: TanStack React Query

## Getting Started

1. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Add your `NEXT_PUBLIC_API_URL` and Neon Auth details.

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Design
This project uses a custom high-end developer SaaS design, built around:
- Deep electric indigo (`#5B5DFF`)
- Cyber teal (`#00C2A8`)
- Neon blue (`#3A8DFF`)
- Dark backgrounds (`#0F1117`, `#161A23`)
