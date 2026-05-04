import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ScorerView from "./pages/ScorerView";
import TvView from "./pages/TvView";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/match/:id/score" element={<ScorerView />} />
        <Route path="/match/:id/tv" element={<TvView />} />
      </Routes>
    </BrowserRouter>
  );
}
