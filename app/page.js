'use client';

import { useEffect, useRef } from 'react';
import { initGame } from './game';

const GAME_HTML = `<div class="fog f1"></div><div class="fog f2"></div>
<div class="slowmo-flash" id="flash"></div>

<!-- ============ HOME ============ -->
<div class="screen on" id="scr-home">
  <div class="logo-sign"><h1>BRIDGE SNAP</h1></div>
  <div class="hook">Cross first. Or make them fall.</div>
  <div class="streak-chip" id="streakChip"></div>

  <div class="rival">
    <div class="face">
      <svg width="30" height="34" viewBox="0 0 24 30" aria-hidden="true"><circle cx="12" cy="6" r="4.5" fill="#E86A45"/><line x1="12" y1="11" x2="12" y2="20" stroke="#E86A45" stroke-width="2.8" stroke-linecap="round"/><line x1="12" y1="14" x2="5" y2="17" stroke="#E86A45" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="14" x2="19" y2="11" stroke="#E86A45" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="20" x2="7" y2="28" stroke="#E86A45" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="20" x2="17" y2="28" stroke="#E86A45" stroke-width="2.5" stroke-linecap="round"/></svg>
    </div>
    <div class="meta">
      <div class="name">RUSTY</div>
      <div class="line" id="rustyLine">"You again? I never lose twice."</div>
    </div>
    <div class="wr"><span id="rustyWr">48%</span><small>WIN RATE</small></div>
  </div>

  <div class="settings">
    <div class="set"><label>Difficulty</label>
      <div class="opts" data-key="diff">
        <button class="opt" data-v="easy">Easy</button>
        <button class="opt sel" data-v="normal">Normal</button>
        <button class="opt" data-v="hard">Hard</button>
        <button class="opt" data-v="insane">Insane</button>
      </div>
    </div>
    <div class="set"><label>Length</label>
      <div class="opts" data-key="len">
        <button class="opt" data-v="10">Short</button>
        <button class="opt sel" data-v="14">Medium</button>
        <button class="opt" data-v="18">Long</button>
      </div>
    </div>
    <div class="set"><label>Lanes</label>
      <div class="opts" data-key="lan">
        <button class="opt" data-v="3">3</button>
        <button class="opt sel" data-v="4">4</button>
        <button class="opt" data-v="5">5</button>
      </div>
    </div>
    <div class="set"><label>Snap charges</label>
      <div class="opts" data-key="chg">
        <button class="opt" data-v="2">2</button>
        <button class="opt sel" data-v="3">3</button>
        <button class="opt" data-v="5">5</button>
      </div>
    </div>
    <div class="set daily-row">
      <div><label>Daily bridge</label><div class="daily-note" id="dailyNote">Same layout for everyone today</div></div>
      <div class="toggle" id="dailyTgl" role="switch" aria-checked="false" tabindex="0"></div>
    </div>
  </div>

  <button class="play-btn" id="playBtn">PLAY</button>
  <div class="howto">
    <b>Tap green planks</b> to move — planks fall behind you.<br>
    <b>Snap</b> breaks a plank in Rusty's path. He can jump gaps — so can you.<br>
    Grab <b style="color:var(--gold)">⚡ charges</b> and <b style="color:#8FB4D8">⏳ slow-downs</b> on the bridge.
  </div>
</div>

<!-- ============ GAME ============ -->
<div class="screen" id="scr-game">
  <div class="hud">
    <div class="side"><span class="pill bot">RUSTY <span id="bS">3</span>⚡</span></div>
    <div id="timer">0.0</div>
    <div class="side"><span class="pill you">YOU <span id="pS">3</span>⚡</span></div>
  </div>
  <div id="board-wrap"><div id="board"><div id="ovl"></div></div></div>
  <div class="controls">
    <button class="snap-btn" id="snapBtn">⚡ SNAP MODE</button>
  </div>
  <div class="legend">
    <span><span class="sw" style="background:#75804A"></span>rotten — falls fast</span>
    <span><span class="sw" style="background:#7E848E"></span>iron — can't snap</span>
    <span><span class="sw" style="background:#5A3D1B"></span>cracking</span>
  </div>
</div>`;

export default function Page() {
  const ref = useRef(null);

  useEffect(() => {
    const cleanup = initGame();
    return cleanup;
  }, []);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: GAME_HTML }} />;
}
