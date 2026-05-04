import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Models ---
interface Match {
  id: string;
  battingTeam: string;
  bowlingTeam: string;
  maxOvers: number;
  maxWickets: number;
  runs: number;
  wickets: number;
  balls: number;
  events: BallEvent[];
  innings: number;
  target?: number;
  rosters: Record<string, string[]>;
  firstInningsScore?: {
    runs: number;
    wickets: number;
    balls: number;
  };
}

interface BallEvent {
  id: string;
  matchId: string;
  batter: string;
  bowler: string;
  runs: number;
  batterScores: number; // runs made by the batter (excluding extras like wides)
  isWicket: boolean;
  dismissalType?: string;
  extrasType?: "wide" | "no-ball" | "leg-bye" | "bye";
  extrasRuns: number;
  isLegalDelivery: boolean;
  timestamp: number;
  innings: number;
}

// In-Memory Data Store
const db = {
  matches: new Map<string, Match>(),
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---
  
  // Get all matches (for home page)
  app.get("/api/matches", (req, res) => {
    const matchesArray = Array.from(db.matches.values());
    res.json(matchesArray);
  });

  // Create a match
  app.post("/api/matches", (req, res) => {
    const { battingTeam, bowlingTeam, maxOvers, maxWickets } = req.body;
    
    if (!battingTeam || !bowlingTeam || !maxOvers || !maxWickets) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const match: Match = {
      id: randomUUID(),
      battingTeam,
      bowlingTeam,
      maxOvers: Number(maxOvers),
      maxWickets: Number(maxWickets),
      runs: 0,
      wickets: 0,
      balls: 0,
      events: [],
      innings: 1,
      rosters: {
        [battingTeam]: [],
        [bowlingTeam]: [],
      },
    };

    db.matches.set(match.id, match);
    broadcastMatchUpdate(match.id);
    res.status(201).json(match);
  });

  // Get a specific match
  app.get("/api/matches/:id", (req, res) => {
    const match = db.matches.get(req.params.id);
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json(match);
  });

  // Add a ball event
  app.post("/api/matches/:id/events", (req, res) => {
    const match = db.matches.get(req.params.id);
    if (!match) return res.status(404).json({ error: "Match not found" });

    // Check if match is already over (basic check)
    // We can allow edits but let's just log events.
    const { runs, batterScores, isWicket, dismissalType, extrasType, extrasRuns, isLegalDelivery, batter, bowler } = req.body;

    const event: BallEvent = {
      id: randomUUID(),
      matchId: match.id,
      batter: batter || "",
      bowler: bowler || "",
      runs: Number(runs) || 0,
      batterScores: Number(batterScores) || 0,
      isWicket: Boolean(isWicket),
      dismissalType,
      extrasType,
      extrasRuns: Number(extrasRuns) || 0,
      isLegalDelivery: Boolean(isLegalDelivery),
      timestamp: Date.now(),
      innings: match.innings,
    };

    match.events.push(event);
    
    // Update derived state
    match.runs += event.runs;
    if (event.isWicket) match.wickets += 1;
    if (event.isLegalDelivery) match.balls += 1;

    db.matches.set(match.id, match);
    broadcastMatchUpdate(match.id);

    res.status(201).json(match);
  });

  // Undo last event
  app.delete("/api/matches/:id/events/last", (req, res) => {
    const match = db.matches.get(req.params.id);
    if (!match) return res.status(404).json({ error: "Match not found" });

    if (match.events.length === 0) {
      return res.status(400).json({ error: "No events to undo" });
    }

    const lastEvent = match.events[match.events.length - 1];
    
    if (lastEvent.innings !== match.innings) {
       return res.status(400).json({ error: "Cannot undo events from the previous innings." });
    }

    match.events.pop();
    
    // Revert derived state
    match.runs -= lastEvent.runs;
    if (lastEvent.isWicket) match.wickets -= 1;
    if (lastEvent.isLegalDelivery) match.balls -= 1;

    db.matches.set(match.id, match);
    broadcastMatchUpdate(match.id);

    res.json(match);
  });

  // Update Roster
  app.post("/api/matches/:id/rosters", (req, res) => {
    const match = db.matches.get(req.params.id);
    if (!match) return res.status(404).json({ error: "Match not found" });

    const { team, roster } = req.body;
    if (!team || !Array.isArray(roster)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    if (!match.rosters) {
      match.rosters = {};
    }
    match.rosters[team] = roster;

    db.matches.set(match.id, match);
    broadcastMatchUpdate(match.id);

    res.json(match);
  });

  // Proceed to 2nd Innings
  app.post("/api/matches/:id/next-innings", (req, res) => {
    const match = db.matches.get(req.params.id);
    if (!match) return res.status(404).json({ error: "Match not found" });

    if (match.innings === 2) {
      return res.status(400).json({ error: "Already in 2nd innings" });
    }

    // Save first innings score
    match.firstInningsScore = {
       runs: match.runs,
       wickets: match.wickets,
       balls: match.balls
    };
    match.target = match.runs + 1;
    match.innings = 2;

    // Swap teams
    const temp = match.battingTeam;
    match.battingTeam = match.bowlingTeam;
    match.bowlingTeam = temp;

    // Reset current active states
    match.runs = 0;
    match.wickets = 0;
    match.balls = 0;

    db.matches.set(match.id, match);
    broadcastMatchUpdate(match.id);
    res.json(match);
  });

  // Server-Sent Events (SSE) for Live TV
  const clients = new Set<express.Response>();
  
  app.get("/api/live", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Send initial ping to establish connection
    res.write(`data: ping\n\n`);

    clients.add(res);

    req.on("close", () => {
      clients.delete(res);
    });
  });

  function broadcastMatchUpdate(matchId: string) {
    const match = db.matches.get(matchId);
    if (!match) return;
    
    const data = JSON.stringify({ type: "MATCH_UPDATE", payload: match });
    for (const client of clients) {
      client.write(`data: ${data}\n\n`);
    }
  }


  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
