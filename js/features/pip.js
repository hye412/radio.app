export function createPiPController({ getCurrent, getAudio, onTogglePlay, onChangeStation, escapeHtml }) {
  let pipWindow = null;

  function update() {
    if (!pipWindow || pipWindow.closed) return;
    const station = getCurrent();
    const audio = getAudio();
    const doc = pipWindow.document;
    const name = doc.getElementById("pipName");
    const meta = doc.getElementById("pipMeta");
    const toggle = doc.getElementById("pipToggle");
    const state = doc.getElementById("pipState");
    if (name) name.textContent = station.name;
    if (meta) meta.textContent = `${station.freq} · ${station.group}`;
    if (toggle) toggle.textContent = audio.paused ? "▶" : "Ⅱ";
    if (state) state.textContent = audio.paused ? "PAUSED" : "ON AIR";
  }

  async function open() {
    if (!("documentPictureInPicture" in window)) {
      alert("현재 브라우저에서는 미니 플레이어 기능을 지원하지 않습니다. Chrome 또는 Edge 최신 버전을 이용해 주세요.");
      return;
    }
    try {
      if (pipWindow && !pipWindow.closed) {
        pipWindow.focus();
        return;
      }
      pipWindow = await window.documentPictureInPicture.requestWindow({ width: 300, height: 142 });
      const doc = pipWindow.document;
      doc.documentElement.style.colorScheme = "dark";
      doc.body.style.cssText = "margin:0;background:#242522;color:#eeece4;font-family:-apple-system,BlinkMacSystemFont,sans-serif";
      const station = getCurrent();
      doc.body.innerHTML = `
        <main style="padding:15px 16px;box-sizing:border-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span style="font-size:10px;letter-spacing:1.5px;color:#aaa">PERSONAL RADIO</span>
            <span id="pipState" style="font-size:10px;color:#d6b18c">PAUSED</span>
          </div>
          <div id="pipName" style="font-size:18px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(station.name)}</div>
          <div id="pipMeta" style="font-size:11px;color:#d6b18c;margin-top:4px">${escapeHtml(`${station.freq} · ${station.group}`)}</div>
          <div style="display:flex;justify-content:center;align-items:center;gap:26px;margin-top:13px">
            <button id="pipPrev" aria-label="이전 방송" style="border:0;background:none;color:#aaa;font-size:19px">‹</button>
            <button id="pipToggle" aria-label="재생 또는 일시정지" style="width:38px;height:34px;border:0;border-radius:18px;background:#d6b18c;color:#292923;font-size:17px">▶</button>
            <button id="pipNext" aria-label="다음 방송" style="border:0;background:none;color:#aaa;font-size:19px">›</button>
          </div>
        </main>`;
      doc.getElementById("pipToggle").addEventListener("click", onTogglePlay);
      doc.getElementById("pipPrev").addEventListener("click", () => onChangeStation(-1));
      doc.getElementById("pipNext").addEventListener("click", () => onChangeStation(1));
      pipWindow.addEventListener("pagehide", () => { pipWindow = null; });
      update();
    } catch (error) {
      console.error("PiP error", error);
      alert("미니 플레이어를 열 수 없습니다. HTTPS 환경과 브라우저 지원 여부를 확인해 주세요.");
    }
  }
  return { open, update };
}
