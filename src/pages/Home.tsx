import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const [battingTeam, setBattingTeam] = useState("");
  const [bowlingTeam, setBowlingTeam] = useState("");
  const [maxOvers, setMaxOvers] = useState("20");
  const [maxWickets, setMaxWickets] = useState("10");
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/matches")
      .then((res) => res.json())
      .then(setMatches)
      .catch(console.error);
  }, []);

  const handleStartMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ battingTeam, bowlingTeam, maxOvers, maxWickets }),
    });
    if (res.ok) {
      const match = await res.json();
      navigate(`/match/${match.id}/score`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <header>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Cricket Scoring MVP</h1>
          <p className="text-neutral-400">Live scoreboard and ball-by-ball capture</p>
        </header>

        <main className="grid md:grid-cols-2 gap-12">
          {/* New Match Form */}
          <section className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Start New Match
            </h2>
            
            <form onSubmit={handleStartMatch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Batting Team</label>
                <input
                  required
                  type="text"
                  value={battingTeam}
                  onChange={(e) => setBattingTeam(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  placeholder="e.g. Scorchers"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Bowling Team</label>
                <input
                  required
                  type="text"
                  value={bowlingTeam}
                  onChange={(e) => setBowlingTeam(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  placeholder="e.g. Thunder"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Overs</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={maxOvers}
                    onChange={(e) => setMaxOvers(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Wickets Cap</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={maxWickets}
                    onChange={(e) => setMaxWickets(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-colors mt-6"
              >
                Create Match
              </button>
            </form>
          </section>

          {/* Active Matches */}
          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Active Matches
            </h2>
            <div className="space-y-4">
              {matches.length === 0 ? (
                <div className="text-neutral-500 border border-neutral-800 border-dashed rounded-xl p-8 text-center bg-neutral-900/50">
                  No active matches found.
                </div>
              ) : (
                matches.map((m) => (
                  <div key={m.id} className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl flex items-center justify-between group hover:border-neutral-700 transition-colors">
                    <div>
                      <div className="font-medium text-lg text-white">
                        {m.battingTeam} <span className="text-neutral-500 text-sm font-normal px-2">vs</span> {m.bowlingTeam}
                      </div>
                      <div className="text-sm text-neutral-400 mt-1">
                        {m.runs}/{m.wickets} ({Math.floor(m.balls / 6)}.{m.balls % 6} / {m.maxOvers} ov)
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/match/${m.id}/score`)}
                        className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors border border-neutral-700 hover:border-neutral-600"
                      >
                        Score
                      </button>
                      <button
                        onClick={() => navigate(`/match/${m.id}/tv`)}
                        className="px-3 py-1.5 text-sm bg-blue-950/30 hover:bg-blue-900/50 text-blue-400 rounded-lg transition-colors border border-blue-900/50 hover:border-blue-800"
                      >
                        TV
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
