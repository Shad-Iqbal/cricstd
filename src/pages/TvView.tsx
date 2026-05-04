import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function TvView() {
  const { id } = useParams();
  const [match, setMatch] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/matches/${id}`)
      .then((res) => res.json())
      .then(setMatch)
      .catch(console.error);

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

  if (!match) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white text-4xl">Loading Score...</div>;
  }

  // Get last 6 valid deliveries + any extras that happened recently to show over timeline
  const recentEvents = [...match.events].reverse().slice(0, 8).reverse();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden pattern-bg">
      {/* CSS Pattern Background for TV aesthetic */}
      <style>{`
        .pattern-bg {
          background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0);
          background-size: 32px 32px;
        }
      `}</style>
      
      {/* Header Bar */}
      <div className="h-24 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-16 shrink-0">
         <div className="text-4xl font-black uppercase tracking-widest text-[#00E5FF] drop-shadow-[0_0_15px_rgba(0,229,255,0.3)]">
            Indoor Pro Series
         </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-12 pb-24">
        
        {/* Main Scoreboard Card */}
        <div className="w-full max-w-6xl bg-gradient-to-b from-[#111] to-black border border-[#222] rounded-[3rem] p-16 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] relative overflow-hidden">
          {/* Accent Glow */}
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#00E5FF] opacity-10 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

          <div className="flex justify-between items-end border-b-2 border-neutral-800 pb-12 mb-12">
             <div className="flex-1">
                <div className="text-3xl font-bold tracking-widest text-neutral-500 uppercase mb-4">Batting</div>
                <div className="text-7xl font-black tracking-tight">{match.battingTeam}</div>
             </div>
             
             <div className="text-right">
                <div className="text-3xl font-bold tracking-widest text-neutral-500 uppercase mb-4">Bowling</div>
                <div className="text-4xl font-semibold text-neutral-300">{match.bowlingTeam}</div>
             </div>
          </div>

          <div className="grid grid-cols-12 gap-8 items-center">
            
            <div className="col-span-7 flex items-baseline gap-4">
              <div className="text-[200px] font-black tabular-nums leading-none tracking-tighter text-[#00E5FF] drop-shadow-[0_0_40px_rgba(0,229,255,0.2)]">
                {match.runs}
              </div>
              <div className="text-8xl font-black text-neutral-600 mb-8">-</div>
              <div className="text-[140px] font-bold tabular-nums leading-none text-white">
                {match.wickets}
              </div>
            </div>
            
            <div className="col-span-5 flex flex-col items-end justify-center space-y-8">
               {match.innings === 2 && match.target && (
                 <div className="bg-red-600 border border-red-500 rounded-[2rem] px-10 py-6 text-center w-full max-w-sm shadow-[0_0_30px_rgba(220,38,38,0.3)]">
                   <div className="text-xl font-bold text-red-200 uppercase tracking-widest mb-1">Target: {match.target}</div>
                   <div className="text-4xl font-black text-white leading-tight">
                     Need {Math.max(0, match.target - match.runs)}
                   </div>
                   <div className="text-xl text-red-200 font-medium tracking-wide mt-1">
                     from {Math.max(0, match.maxOvers * 6 - match.balls)} balls
                   </div>
                 </div>
               )}

               <div className="bg-[#1a1a1a] border border-[#333] rounded-[2rem] px-10 py-6 text-center w-full max-w-xs shadow-inner">
                 <div className="text-2xl font-semibold text-neutral-500 uppercase tracking-widest mb-2">Overs</div>
                 <div className="text-6xl font-mono font-bold text-white tabular-nums">
                    {Math.floor(match.balls / 6)}<span className="text-[#00E5FF] opacity-50 mx-1">.</span>{match.balls % 6}
                 </div>
               </div>
               
               <div className="text-2xl text-neutral-400 font-medium tracking-wide">
                 Max Overs: <span className="text-white font-bold">{match.maxOvers}</span>
               </div>
               <div className="text-2xl text-neutral-400 font-medium tracking-wide">
                 Wickets Cap: <span className="text-white font-bold">{match.maxWickets}</span>
               </div>
            </div>

          </div>

        </div>

        {/* Recent Balls Timeline */}
        <div className="mt-16 w-full max-w-6xl">
           <div className="text-xl font-bold tracking-widest text-neutral-600 uppercase mb-6 ml-4">Recent Deliveries</div>
           <div className="flex items-center gap-4">
              {recentEvents.length === 0 ? (
                <div className="text-neutral-500 italic text-xl">No deliveries yet</div>
              ) : (
                recentEvents.map((ev: any) => {
                  let badge = "";
                  let color = "bg-[#222] border-[#333] text-white";
                  
                  if (ev.isWicket) {
                    badge = "W";
                    color = "bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]";
                  } else if (ev.extrasType) {
                    badge = `${ev.extrasRuns}${ev.extrasType === 'wide' ? 'wd' : ev.extrasType === 'no-ball' ? 'nb' : ev.extrasType === 'leg-bye' ? 'lb' : 'b'}`;
                    color = "bg-orange-500 border-orange-400 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]";
                  } else if (ev.runs === 4) {
                    badge = "4";
                    color = "bg-emerald-600 border-emerald-500 text-white shadow-[0_0_20px_rgba(5,150,105,0.4)]";
                  } else if (ev.runs === 6) {
                    badge = "6";
                    color = "bg-[#00E5FF] border-[#00B3CC] text-black shadow-[0_0_20px_rgba(0,229,255,0.4)]";
                  } else {
                     badge = ev.runs.toString();
                  }

                  return (
                     <div key={ev.id} className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black border-2 transition-all ${color}`}>
                        {badge}
                     </div>
                  )
                })
              )}
           </div>
        </div>

      </div>
    </div>
  );
}
