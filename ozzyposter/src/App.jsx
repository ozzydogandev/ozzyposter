import React, { useEffect, useState } from "react";
import "./App.css";
import poster from "./assets/ozzy-poster3.svg";
import {
  Button,
  Menu, MenuItem,
  Portal,
} from "@chakra-ui/react";

// ---------------------- helpers ----------------------
function randInt(n) { return Math.floor(Math.random() * n); }
function choice(arr) { return arr[randInt(arr.length)]; }

// history penceresi (tekrar engelleme)
const RECENT_WINDOW = 20;

// ---------------------- component ----------------------
export default function App() {
  const [screen, setScreen] = useState("setup"); // 'setup' | 'countdown' | 'handoff' | 'reveal' | 'done'
  const [playerInput, setPlayerInput] = useState(''); // '' means empty field
  const [lastCount, setLastCount] = useState(() => {
  const s = localStorage.getItem('ozzyposter_last_count');
  return s ? Number(s) : ""; // default fallback
});
  const [mode, setMode] = useState("select");    // 'select' | 'different'
  const [countdown, setCountdown] = useState(3);

  // runtime
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [imposterIndex, setImposterIndex] = useState(null);
  const [mainWord, setMainWord] = useState(null);
  const [imposterWord, setImposterWord] = useState(null);

  // linked words JSON
  const [linkedWords, setLinkedWords] = useState([]);
  const [loadingWords, setLoadingWords] = useState(true);

  // recent history (localStorage)
  const [recentWords, setRecentWords] = useState(() => {
    try {
      const raw = localStorage.getItem("ozzyposter_recent_words");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ozzyposter_recent_words", JSON.stringify(recentWords));
    } catch {}
  }, [recentWords]);

  // ---------------------- load JSON from public/ ----------------------
  useEffect(() => {
    let alive = true;
    setLoadingWords(true);
    fetch("/words/words.tr.linked.v1.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        if (!alive) return;
        // Beklenen format: [{ w: "kelime", rel: "related" }, ...]
        setLinkedWords(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        console.error("Kelime listesi yüklenemedi:", e);
        setLinkedWords([]);
      })
      .finally(() => {
        if (alive) setLoadingWords(false);
      });
    return () => { alive = false; };
  }, []);

  // ---------------------- no-repeat picker ----------------------
  function pickNextWordObj() {
    if (!linkedWords?.length) return null;

    // recent listeden olmayanlar
    const pool = linkedWords.filter((x) => !recentWords.includes(x.w));
    const list = pool.length ? pool : linkedWords; // fallback

    return choice(list);
  }

function ResetButton({ onClick }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
      <button className="resetbutton" onClick={onClick}>
        Reset Game 🔄
      </button>
    </div>
  );
}

  function pushRecent(w) {
    setRecentWords((prev) => {
      const next = [w, ...prev.filter((x) => x !== w)];
      return next.slice(0, RECENT_WINDOW);
    });
  }

  // ---------------------- game flow ----------------------
  const wordsReady = linkedWords.length > 0 && !loadingWords;
  const effectiveCount = playerInput === '' ? lastCount : Number(playerInput);
  const canStart =
    playerCountOk(effectiveCount) && wordsReady;

  function playerCountOk(n) {
    return Number.isFinite(n) && n >= 3 && n <= 24;
  }

function startGame() {
  const count = effectiveCount;
  if (!playerCountOk(count)) return;

  // persist last used only when user typed something new
  if (playerInput !== '') {
    setLastCount(count);
    try { localStorage.setItem('ozzyposter_last_count', String(count)); } catch {}
  }

  const chosen = pickNextWordObj();
  if (!chosen) return;

  const impostor = randInt(count);
  setMainWord(chosen.w);
  setImposterIndex(impostor);
  setImposterWord(mode === 'different' ? chosen.rel : null);

  setCurrentPlayer(0);
  setCountdown(3);
  setScreen('countdown');

  // keep the field empty for next round (as you wanted)
  setPlayerInput('');
}

  // countdown
  useEffect(() => {
    if (screen !== "countdown") return;
    let i = 3;
    setCountdown(i);
    const t = setInterval(() => {
      i -= 1;
      setCountdown(i);
      if (i <= 0) {
        clearInterval(t);
        setScreen("handoff");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [screen]);

  function getDisplayForPlayer(i) {
    if (!mainWord) return { title: "…", detail: "" };
    if (mode === "select") {
      if (i === imposterIndex) {
        return {
          title: "YOU ARE THE IMPOSTER",
          detail: "Blend in. Say a hint word without giving yourself away.",
        };
      }
      return { title: `Secret word: ${mainWord}`, detail: "Everyone else has the same word." };
    }
    // different word mode
    if (i === imposterIndex) {
      return {
        title: `Secret word: ${imposterWord}`,
        detail: "One player has a related word.",
      };
    }
    return { title: `Secret word: ${mainWord}`, detail: "One player has a related word." };
  }

  function onConfirm() {
    if (currentPlayer + 1 < effectiveCount) {
      setCurrentPlayer((p) => p + 1);
      setScreen("handoff");
    } else {
      setScreen("done");
    }
  }

  // ---------------------- render ----------------------
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src={poster} alt="Ozzyposter logo" className="logo" />
        </div>
        <div className="tagline">A quick & fun imposter party game</div>
      </header>
     

      {screen === "setup" && (
        <div className="card">
          <div className="section">
            <div className="row">
              <label>
                How many players?
                  <input
                    type="number"
                    min={3}
                    max={24}
                    value={playerInput}                   // stays '' when empty
                    placeholder={String(lastCount)}       // shows last used as hint
                    onChange={(e) => {
                      const v = e.target.value;
                      // allow empty, otherwise keep as-is (browser enforces numeric)
                      setPlayerInput(v === '' ? '' : v);
                    }}
                  />
                </label>
            </div>
          </div>

          <div className="section">
            <label>Game mode</label>

            <div className="row">
              {/* Chakra dropdown (Menu.Root yapısı, Portal ile) */}
              <Menu.Root>
                <Menu.Trigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    width="100%"
                    height="48px"
                    borderRadius="12px"
                  >
                    {mode === "select" ? "Select Imposter" : "Different word to imposter"}
                  </Button>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.Item value="select" onClick={() => setMode("select")}>
                        Select Imposter
                      </Menu.Item>
                      <Menu.Item value="different" onClick={() => setMode("different")}>
                        Different word to imposter
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            </div>

            <div className="smallmuted" style={{ marginTop: 8 }}>
              <div>• <b>Select Imposter</b>: one player sees “YOU ARE THE IMPOSTER”; others see the same word.</div>
              <div>• <b>Different word</b>: imposter gets a related word; others see the main word.</div>
            </div>
          </div>

          <div className="section button-stack">
            <button className="btn" disabled={!canStart} onClick={startGame}>
              {wordsReady ? "Start" : "Loading words…"}
            </button>
          </div>
        </div>
      )}
      {screen === 'countdown' && (
        <>
          <div className="card center">
            <div className="big">Word is being generated…</div>
            <div className="counter">{countdown > 0 ? countdown : 'Go!'}</div>
            <div className="smallmuted">Don’t peek unless it’s your turn.</div>
          </div>
          <ResetButton onClick={() => setScreen('setup')} />
        </>
      )}

      {screen === 'handoff' && (
        <>
          <div className="card center">
            <div className="big">Player {currentPlayer + 1}</div>
            <p className="section">Please hand the phone to <b>Player {currentPlayer + 1}</b>.</p>
            <div className="section button-stack">
              <button className="btn" onClick={()=>setScreen('reveal')}>I'm ready</button>
            </div>
            <div className="smallmuted" style={{marginTop:10}}>{currentPlayer + 1} / {effectiveCount}</div>
          </div>
          <ResetButton onClick={() => setScreen('setup')} />
        </>
      )}

      {screen === 'reveal' && (
        <>
          <div className="card center">
            <div className="smallmuted" style={{marginBottom:6}}>
              Player {currentPlayer + 1} of {effectiveCount}
            </div>
            {(() => {
              const d = getDisplayForPlayer(currentPlayer)
              return (
                <>
                  <div className="big" style={{marginBottom:8}}>{d.title}</div>
                  <div className="section" style={{color:'#4b5563'}}>{d.detail}</div>
                </>
              )
            })()}
            <div className="section button-stack">
              <button className="btn" onClick={onConfirm}>Confirmed</button>
            </div>
          </div>
          <ResetButton onClick={() => setScreen('setup')} />
        </>
      )}

      {screen === "done" && (
        <div className="card center">
          <div className="big">Pass it back</div>
          <p className="section">
            All players have seen their info. Please give the phone back to owner.
          </p>
          <div className="button-stack section">
            <button className="btn" onClick={() => setScreen("setup")}>New Game</button>
          </div>
        </div>
      )}

      <footer className="footer">
        Made for friends • Pass the phone around
      </footer>
    </div>
  );
}
