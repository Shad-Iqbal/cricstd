import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, RotateCcw, Users, X, Plus } from "lucide-react";

export default function ScorerView() {
  const { id } = useParams();
  const [match, setMatch] = useState<any>(null);
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [currentBowler, setCurrentBowler] = useState("");

  const [showCustom, setShowCustom] = useState(false);
  const [cRuns, setCRuns] = useState<number>(0);
  const [cExtrasType, setCExtrasType] = useState<string>("");
  const [cExtrasRuns, setCExtrasRuns] = useState<number>(0);
  const [cIsWicket, setCIsWicket] = useState<boolean>(false);
  const [cIsLegal, setCIsLegal] = useState<boolean>(true);
  const [cDismissalType, setCDismissalType] = useState<string>("run-out");

  const [showRosterModal, setShowRosterModal] = useState(false);
  const [activeRosterTeam, setActiveRosterTeam] = useState<string>("");
  const [newPlayerName, setNewPlayerName] = useState("");

  const [showAddStriker, setShowAddStriker] = useState(false);
  const [showAddNonStriker, setShowAddNonStriker] = useState(false);
  const [showAddBowler, setShowAddBowler] = useState(false);

  useEffect(() => {
    fetch(`/api/matches/${id}`)
      .then((res) => res.json())
      .then(setMatch)
      .catch(console.error);

    // Setup SSE to keep scorer in sync if multiple tabs open (optional but good)
    const sse = new EventSource("/api/live");
    sse.onmessage = (e) => {
      if (e.data === "ping") return;
      const data = JSON.parse(e.data);
      if (data.type === "MATCH_UPDATE" && data.payload.id === id) {
        setMatch(data.payload);
      }
    };
    return () => sse.close();
  }, [id]);

  const recordBall = async (payload: any) => {
    if (!match) return;
    const res = await fetch(`/api/matches/${match.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, batter: striker, bowler: currentBowler }),
    });

    if (res.ok) {
      // Logic for changing strike
      const runsToCheck = payload.extrasType === 'wide' || payload.extrasType === 'no-ball' 
        ? payload.batterScores 
        : payload.batterScores + ((payload.extrasType === 'bye' || payload.extrasType === 'leg-bye') ? payload.extrasRuns : 0);
        
      const oddRuns = !!(runsToCheck % 2);
      const willBeEndOfOver = payload.isLegalDelivery && ((match.balls + 1) % 6 === 0);
      
      let needsSwitch = oddRuns;
      if (willBeEndOfOver) {
          needsSwitch = !needsSwitch;
      }

      if (needsSwitch) {
          setStriker((prevStriker) => {
             setNonStriker(prevStriker);
             // We need to return the latest nonStriker, but we only have closure nonStriker.
             // To be 100% robust we should use a single state object, but for this MVP,
             // using the closure values is fine because humans score one ball at a time.
             return nonStriker;
          });
      }

      setShowAddStriker(false);
      setShowAddNonStriker(false);
      setShowAddBowler(false);
    }
  };

  const undoLast = async () => {
    if (!match) return;
    if (!confirm("Undo the last ball?")) return;
    
    await fetch(`/api/matches/${match.id}/events/last`, {
      method: "DELETE",
    });
  };

  const startNextInnings = async () => {
    if (!match) return;
    if (!confirm("Proceed to 2nd innings?")) return;
    
    await fetch(`/api/matches/${match.id}/next-innings`, {
      method: "POST",
    });
  };

  const addPlayerToRoster = async () => {
    if (!match || !newPlayerName.trim()) return;
    const currentRoster = match.rosters?.[activeRosterTeam] || [];
    if (currentRoster.includes(newPlayerName.trim())) return;

    const newRoster = [...currentRoster, newPlayerName.trim()];
    await fetch(`/api/matches/${match.id}/rosters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: activeRosterTeam, roster: newRoster }),
    });
    setNewPlayerName("");
  };

  const removePlayerFromRoster = async (name: string) => {
    if (!match) return;
    const currentRoster = match.rosters?.[activeRosterTeam] || [];
    const newRoster = currentRoster.filter((p: string) => p !== name);
    
    await fetch(`/api/matches/${match.id}/rosters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: activeRosterTeam, roster: newRoster }),
    });
  };

  const submitCustom = () => {
    recordBall({
      runs: cRuns + cExtrasRuns,
      batterScores: cRuns,
      isWicket: cIsWicket,
      dismissalType: cIsWicket ? cDismissalType : undefined,
      extrasType: cExtrasType || undefined,
      extrasRuns: cExtrasRuns,
      isLegalDelivery: cIsLegal,
    });
    setCRuns(0);
    setCExtrasType("");
    setCExtrasRuns(0);
    setCIsWicket(false);
    setCIsLegal(true);
    setCDismissalType("run-out");
    setShowCustom(false);
  };

  if (!match) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Loading...</div>;
  }

  const isInningsComplete = match.wickets >= match.maxWickets || Math.floor(match.balls / 6) >= match.maxOvers;

  // Derive all players from roster to populate dropdowns
  const battingTeamRoster = match.rosters?.[match.battingTeam] || [];
  const bowlingTeamRoster = match.rosters?.[match.bowlingTeam] || [];

  const matchBatters = Array.from(new Set([...battingTeamRoster, ...match.events.map((e: any) => e.batter).filter(Boolean)]));
  const matchBowlers = Array.from(new Set([...bowlingTeamRoster, ...match.events.map((e: any) => e.bowler).filter(Boolean)]));

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 p-4 shrink-0 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Exit</span>
          </Link>
          <div className="text-center">
            <div className="text-sm font-medium text-neutral-400">
              {match.battingTeam} <span className="font-normal mx-1">v</span> {match.bowlingTeam}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Match ID: {match.id.substring(0,8)}</div>
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={() => {
                 setActiveRosterTeam(match.battingTeam);
                 setShowRosterModal(true);
               }}
               className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
             >
               <Users className="w-4 h-4" />
               Rosters
             </button>
             <Link to={`/match/${match.id}/tv`} target="_blank" className="px-3 py-1.5 text-sm font-medium text-blue-400 bg-blue-950/30 rounded-lg border border-blue-900/50 hover:bg-blue-900/50 transition-colors">
               Open TV
             </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 relative">
        {/* Roster Modal Overlay */}
        {showRosterModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
             <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white">Team Rosters</h2>
                  <button onClick={() => setShowRosterModal(false)} className="text-neutral-400 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="flex gap-2 mb-6 p-1 bg-neutral-950 rounded-xl shrink-0">
                  <button 
                    onClick={() => setActiveRosterTeam(match.battingTeam)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeRosterTeam === match.battingTeam ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-300'}`}
                  >
                    {match.battingTeam}
                  </button>
                  <button 
                    onClick={() => setActiveRosterTeam(match.bowlingTeam)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeRosterTeam === match.bowlingTeam ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-300'}`}
                  >
                    {match.bowlingTeam}
                  </button>
                </div>

                <div className="flex gap-2 mb-6 shrink-0">
                  <input 
                    type="text" 
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter') addPlayerToRoster(); }}
                    placeholder="Enter player name..."
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button 
                    onClick={addPlayerToRoster}
                    disabled={!newPlayerName.trim()}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 font-medium px-4 py-2.5 rounded-xl transition-colors"
                  >
                    Add
                  </button>
                </div>

                <div className="flex-1 flex flex-col space-y-2 overflow-y-auto">
                   {(match.rosters?.[activeRosterTeam] || []).length === 0 ? (
                     <div className="text-center text-neutral-500 py-8 italic text-sm">No players added to this roster yet.</div>
                   ) : (
                     (match.rosters?.[activeRosterTeam] || []).map((player: string) => (
                       <div key={player} className="flex items-center justify-between bg-neutral-950 border border-neutral-800 px-4 py-3 rounded-xl group hover:border-neutral-700 transition-colors">
                         <span className="text-neutral-200">{player}</span>
                         <button 
                           onClick={() => removePlayerFromRoster(player)}
                           className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                         >
                           <X className="w-4 h-4" />
                         </button>
                       </div>
                     ))
                   )}
                </div>
             </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto grid lg:grid-cols-12 gap-8">
          
          {/* Section 1: Match Frame (Score) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-row items-center justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-transparent"></div>
              
              <div className="flex flex-col">
                <div className="text-neutral-400 font-medium text-sm mb-1">
                  {match.battingTeam} Batting
                </div>
                <div className="text-5xl font-bold tracking-tighter tabular-nums leading-none">
                  {match.runs}<span className="text-neutral-600 font-light mx-1">/</span>{match.wickets}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1 font-medium">Overs</div>
                  <div className="text-2xl font-bold font-mono">
                    {Math.floor(match.balls / 6)}<span className="text-neutral-500 text-lg mx-0.5">.</span>{match.balls % 6}
                    <span className="text-neutral-500 text-sm ml-1 font-normal">/ {match.maxOvers}</span>
                  </div>
                </div>
                
                {isInningsComplete && (
                   <div className="bg-red-950/30 text-red-500 border border-red-900/50 rounded-xl px-4 py-2 font-medium text-sm flex items-center justify-between gap-3">
                      <span>Innings Complete</span>
                      {match.innings === 1 && (
                        <button 
                          onClick={startNextInnings}
                          className="px-3 py-1.5 bg-red-500 text-white hover:bg-red-600 rounded-lg text-xs transition-colors"
                        >
                          Start 2nd Innings
                        </button>
                      )}
                   </div>
                )}

                {!isInningsComplete && match.innings === 1 && (
                  <button 
                    onClick={startNextInnings}
                    className="bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                  >
                    End 1st
                  </button>
                )}
              </div>
            </div>

            {/* Section 2: Ball Pipeline (Controls) */}
            <div className={`space-y-6 ${isInningsComplete ? 'opacity-50 pointer-events-none' : ''}`}>
              {match.balls > 0 && match.balls % 6 === 0 && !isInningsComplete && (
                <div className="bg-orange-950/40 border border-orange-900/50 text-orange-400 px-4 py-3 rounded-2xl flex items-center justify-center font-medium animate-pulse shadow-inner">
                  End of Over! Please change the bowler.
                </div>
              )}

              {/* Players Setup */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr] gap-4 items-end">
                <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-3xl flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Striker</label>
                    <button onClick={() => setShowAddStriker(!showAddStriker)} className="text-neutral-500 hover:text-white" type="button"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!showAddStriker ? (
                      <select 
                        value={matchBatters.includes(striker) ? striker : ""}
                        onChange={e => setStriker(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="" disabled>Select...</option>
                        {matchBatters.map((b: any) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={striker}
                        onChange={(e) => setStriker(e.target.value)}
                        placeholder="Type new..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                      />
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    setStriker(nonStriker);
                    setNonStriker(striker);
                  }}
                  className="mb-4 p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition-colors shrink-0 mx-auto"
                  title="Swap Striker & Non-Striker"
                  type="button"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-3xl flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Non-Striker</label>
                    <button onClick={() => setShowAddNonStriker(!showAddNonStriker)} className="text-neutral-500 hover:text-white" type="button"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!showAddNonStriker ? (
                      <select 
                        value={matchBatters.includes(nonStriker) ? nonStriker : ""}
                        onChange={e => setNonStriker(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="" disabled>Select...</option>
                        {matchBatters.map((b: any) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={nonStriker}
                        onChange={(e) => setNonStriker(e.target.value)}
                        placeholder="Type new..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                      />
                    )}
                  </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-3xl flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Bowler</label>
                    <button onClick={() => setShowAddBowler(!showAddBowler)} className="text-neutral-500 hover:text-white" type="button"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!showAddBowler ? (
                      <select 
                        value={matchBowlers.includes(currentBowler) ? currentBowler : ""}
                        onChange={e => setCurrentBowler(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="" disabled>Select...</option>
                        {matchBowlers.map((b: any) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={currentBowler}
                        onChange={(e) => setCurrentBowler(e.target.value)}
                        placeholder="Type new..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Runs */}
              <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Runs</h3>
                <div className="grid grid-cols-7 gap-3">
                  {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                    <button
                      key={r}
                      onClick={() => recordBall({ runs: r, batterScores: r, isLegalDelivery: true })}
                      className="aspect-square bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 rounded-2xl text-2xl font-bold flex items-center justify-center transition-all shadow-sm"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extras & Wickets */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Extras & Events</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => recordBall({ runs: 1, extrasRuns: 1, extrasType: "wide", isLegalDelivery: false })} className="bg-neutral-800 hover:bg-neutral-700 py-3 rounded-xl font-medium transition-colors">Wide (+1)</button>
                    <button onClick={() => recordBall({ runs: 1, extrasRuns: 1, extrasType: "no-ball", isLegalDelivery: false })} className="bg-neutral-800 hover:bg-neutral-700 py-3 rounded-xl font-medium transition-colors">No Ball (+1)</button>
                    <button onClick={() => recordBall({ runs: 1, extrasRuns: 1, extrasType: "leg-bye", isLegalDelivery: true })} className="bg-neutral-800 hover:bg-neutral-700 py-3 rounded-xl font-medium transition-colors">Leg Bye (+1)</button>
                    <button onClick={() => recordBall({ runs: 1, extrasRuns: 1, extrasType: "bye", isLegalDelivery: true })} className="bg-neutral-800 hover:bg-neutral-700 py-3 rounded-xl font-medium transition-colors">Bye (+1)</button>
                  </div>
                </div>

                <div className="bg-red-950/20 border border-red-900/30 p-6 rounded-3xl flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wider">Wicket</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 flex-1">
                     {/* For MVP just a generic Wicket */}
                     <button onClick={() => recordBall({ runs: 0, isWicket: true, isLegalDelivery: true, dismissalType: "bowled" })} className="bg-red-900/40 hover:bg-red-900/60 text-red-100 py-3 rounded-xl font-medium transition-colors col-span-2">Bowled / Caught</button>
                     <button onClick={() => recordBall({ runs: 0, isWicket: true, isLegalDelivery: true, dismissalType: "run-out" })} className="bg-red-900/40 hover:bg-red-900/60 text-red-100 py-3 rounded-xl font-medium transition-colors col-span-2">Run Out</button>
                  </div>
                </div>
              </div>

              {/* Custom Event */}
              <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl">
                <button 
                  onClick={() => setShowCustom(!showCustom)}
                  className="w-full text-left flex items-center justify-between font-semibold text-neutral-400 uppercase tracking-wider"
                >
                  Custom Delivery (Wide + Run Out, etc)
                  <span className="text-xl leading-none">{showCustom ? '-' : '+'}</span>
                </button>
                
                {showCustom && (
                  <div className="mt-6 space-y-4 border-t border-neutral-800 pt-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-neutral-500 mb-1">Batter Runs</label>
                        <input type="number" min="0" value={cRuns} onChange={e => setCRuns(parseInt(e.target.value) || 0)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none focus:border-neutral-600" />
                      </div>
                      <div>
                        <label className="block text-sm text-neutral-500 mb-1">Extras Runs</label>
                        <input type="number" min="0" value={cExtrasRuns} onChange={e => setCExtrasRuns(parseInt(e.target.value) || 0)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none focus:border-neutral-600" />
                      </div>
                      <div>
                        <label className="block text-sm text-neutral-500 mb-1">Extras Type</label>
                        <select value={cExtrasType} onChange={e => setCExtrasType(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none focus:border-neutral-600">
                          <option value="">None</option>
                          <option value="wide">Wide</option>
                          <option value="no-ball">No Ball</option>
                          <option value="leg-bye">Leg Bye</option>
                          <option value="bye">Bye</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 py-4">
                       <label className="flex items-center gap-2 text-sm text-white cursor-pointer select-none">
                         <input type="checkbox" checked={cIsWicket} onChange={e => setCIsWicket(e.target.checked)} className="w-4 h-4 rounded border-neutral-800 bg-neutral-950 text-blue-500 focus:ring-blue-500 focus:ring-offset-neutral-900" />
                         Is Wicket?
                       </label>
                       {cIsWicket && (
                         <div className="flex items-center gap-2">
                            <label className="text-sm text-neutral-500">Dismissal Type:</label>
                            <select value={cDismissalType} onChange={e => setCDismissalType(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-white text-sm outline-none focus:border-neutral-600">
                              <option value="run-out">Run Out</option>
                              <option value="stumped">Stumped</option>
                              <option value="hit-wicket">Hit Wicket</option>
                              <option value="obstructing">Obstructing Field</option>
                              <option value="bowled">Bowled/Caught (Generic)</option>
                            </select>
                         </div>
                       )}
                       <label className="flex items-center gap-2 text-sm text-white cursor-pointer select-none">
                         <input type="checkbox" checked={cIsLegal} onChange={e => setCIsLegal(e.target.checked)} className="w-4 h-4 rounded border-neutral-800 bg-neutral-950 text-blue-500 focus:ring-blue-500 focus:ring-offset-neutral-900" />
                         Legal Delivery (Counts as ball)
                       </label>
                    </div>

                    <button 
                      onClick={submitCustom}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors"
                    >
                      Log Custom Ball
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar: Log */}
          <div className="lg:col-span-4 flex flex-col h-[800px]">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl flex flex-col h-full overflow-hidden">
              <div className="p-5 border-b border-neutral-800 flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-white">Ball Log</h3>
                <button 
                  onClick={undoLast}
                  disabled={match.events.length === 0}
                  className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:hover:bg-neutral-800 text-neutral-300 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Undo
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col-reverse">
                {match.events.map((ev: any, i: number) => {
                  let badge = "";
                  let color = "bg-neutral-800 text-neutral-300";
                  
                  if (ev.isWicket) {
                    badge = "W";
                    color = "bg-red-500 text-white font-bold";
                  } else if (ev.extrasType) {
                    badge = `${ev.extrasRuns}${ev.extrasType === 'wide' ? 'wd' : ev.extrasType === 'no-ball' ? 'nb' : ev.extrasType === 'leg-bye' ? 'lb' : 'b'}`;
                    color = "bg-orange-500 text-white font-bold";
                  } else if (ev.runs === 4 || ev.runs === 6) {
                    badge = ev.runs.toString();
                    color = ev.runs === 6 ? "bg-blue-600 text-white font-bold" : "bg-emerald-600 text-white font-bold";
                  } else {
                    badge = ev.runs.toString();
                  }

                  return (
                    <div key={ev.id} className="flex flex-row-reverse items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                      <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm ${color}`}>
                            {badge}
                         </div>
                      </div>
                      <div className="flex flex-col">
                        <div className="text-sm text-neutral-500 font-mono">
                          Ball #{i + 1}
                        </div>
                        {(ev.batter || ev.bowler) && (
                          <div className="text-xs text-neutral-600 mt-0.5">
                            {ev.bowler ? `${ev.bowler} to ` : ''}{ev.batter || 'Unknown'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {match.events.length === 0 && (
                  <div className="text-center text-neutral-500 p-8 h-full flex items-center justify-center italic">
                    No balls bowled yet.
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
