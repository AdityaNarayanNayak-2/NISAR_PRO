// NISAR Pro intro video. Every number here comes from ingarss_2026 (result JSONs,
// benchmarks.json, sentinel2_validation.json). Do not add numbers that are not there.
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const C = {
  bg: "#090f1c",
  land: "#13233b",
  ink: "#e2e8f0",
  dim: "#94a3b8",
  sky: "#38bdf8",
  orange: "#f97316",
  amber: "#fbbf24",
  teal: "#2dd4bf",
  red: "#ef4444",
  green: "#22c55e",
};
const FONT = "Inter, 'Segoe UI', Arial, sans-serif";

// Scene lengths in frames (30 fps).
const S = { hook: 150, title: 120, problem: 180, engine: 240, bands: 240, season: 210, check: 150, end: 150 };
export const TOTAL = Object.values(S).reduce((a, b) => a + b, 0);

const useWide = () => {
  const { width, height } = useVideoConfig();
  return width > height;
};

const fade = (f: number, len: number, inF = 12, outF = 12) =>
  interpolate(f, [0, inF, len - outF, len], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const rise = (f: number, delay = 0) =>
  interpolate(f - delay, [0, 18], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

const appear = (f: number, delay = 0) =>
  interpolate(f - delay, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const fmt = (v: number, dec = 0) => v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const countUp = (f: number, start: number, dur: number, to: number) =>
  to * interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

const Label: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({
  children,
  color = C.dim,
  size = 26,
  style,
}) => (
  <div style={{ fontFamily: FONT, color, fontSize: size, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, ...style }}>
    {children}
  </div>
);

// ---------------------------------------------------------------- 1. Hook
const Typed: React.FC<{ text: string; start: number; color: string }> = ({ text, start, color }) => {
  const f = useCurrentFrame();
  const n = Math.floor(interpolate(f, [start, start + text.length * 1.4], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const caret = f >= start && n < text.length;
  return (
    <div style={{ opacity: f >= start ? 1 : 0, color, minHeight: "1.2em" }}>
      {text.slice(0, n)}
      <span style={{ opacity: caret ? 1 : 0, color: C.sky }}>▍</span>
    </div>
  );
};

const Hook = () => {
  const f = useCurrentFrame();
  const wide = useWide();
  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center", opacity: fade(f, S.hook, 1, 14) }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: wide ? 104 : 84, lineHeight: 1.25, letterSpacing: -2 }}>
        <Typed text="2.3 billion radar pixels." start={6} color={C.ink} />
        <Typed text="2.3 GB of RAM." start={50} color={C.sky} />
        <Typed text="About a minute." start={86} color={C.amber} />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 2. Title
const MapBackdrop: React.FC<{ len: number; dim?: number }> = ({ len, dim = 0.55 }) => {
  const f = useCurrentFrame();
  const scale = interpolate(f, [0, len], [1.08, 1.0]);
  return (
    <AbsoluteFill>
      <Img src={staticFile("hero.png")} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(9,15,28,${dim * 0.6}) 0%, rgba(9,15,28,${dim}) 55%, rgba(9,15,28,0.92) 100%)` }} />
    </AbsoluteFill>
  );
};

const Title = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wide = useWide();
  const s = spring({ frame: f - 8, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ opacity: fade(f, S.title, 10, 12) }}>
      <MapBackdrop len={S.title} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", fontFamily: FONT }}>
        <div style={{ fontSize: wide ? 150 : 128, fontWeight: 900, color: "#fff", letterSpacing: -4, transform: `scale(${0.9 + 0.1 * s})`, opacity: s }}>
          NISAR <span style={{ color: C.sky }}>Pro</span>
        </div>
        <div style={{ width: 120 * s, height: 6, background: C.orange, margin: "18px auto 26px", borderRadius: 3 }} />
        <div style={{ fontSize: wide ? 40 : 36, color: C.ink, opacity: appear(f, 30), transform: `translateY(${rise(f, 30)}px)`, padding: "0 60px" }}>
          Pure Rust engine for NASA-ISRO NISAR radar data
        </div>
        <Label style={{ marginTop: 22, opacity: appear(f, 48) }} color={C.amber}>
          L-band + S-band · surface water
        </Label>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 3. Problem
const Meter: React.FC<{ label: string; value: number; max: number; text: string; color: string; start: number }> = ({
  label,
  value,
  max,
  text,
  color,
  start,
}) => {
  const f = useCurrentFrame();
  const w = interpolate(f, [start, start + 40], [0, value / max], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ opacity: appear(f, start - 6), marginBottom: 34 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, color: C.ink, fontSize: 30, marginBottom: 10 }}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 800, opacity: appear(f, start + 30) }}>{text}</span>
      </div>
      <div style={{ height: 28, background: C.land, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ width: `${w * 100}%`, height: "100%", background: color, borderRadius: 14 }} />
      </div>
    </div>
  );
};

const Problem = () => {
  const f = useCurrentFrame();
  const wide = useWide();
  return (
    <AbsoluteFill style={{ background: C.bg, opacity: fade(f, S.problem), padding: wide ? "0 200px" : "0 80px", fontFamily: FONT, justifyContent: "center" }}>
      <Label color={C.orange}>The problem</Label>
      <div style={{ fontSize: wide ? 62 : 52, fontWeight: 800, color: "#fff", margin: "16px 0 10px", opacity: appear(f, 4), transform: `translateY(${rise(f, 4)}px)` }}>
        One NISAR scene: 33,696 × 34,344 pixels
      </div>
      <div style={{ fontSize: 34, color: C.dim, marginBottom: 70, opacity: appear(f, 20) }}>
        Two dates = <b style={{ color: C.ink }}>2.31 billion</b> values to compare
      </div>
      <Meter label="Load it all at once (just to hold the numbers)" value={9.26} max={10} text="9.3 GB" color={C.red} start={45} />
      <Meter label="NISAR Pro, reading in strips" value={2.32} max={10} text="2.3 GB peak" color={C.green} start={95} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 4. Engine
const Engine = () => {
  const f = useCurrentFrame();
  const wide = useWide();
  const strips = 12;
  const sweep = interpolate(f, [30, 190], [0, strips], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const big = wide ? 520 : 400;
  const small = wide ? 260 : 200;
  const outCells = 16;
  return (
    <AbsoluteFill style={{ background: C.bg, opacity: fade(f, S.engine), fontFamily: FONT, alignItems: "center", justifyContent: "center" }}>
      <Label color={C.sky}>How the Rust engine does it</Label>
      <div style={{ display: "flex", alignItems: "center", gap: wide ? 90 : 40, marginTop: 40 }}>
        {/* raw scene, read strip by strip */}
        <div style={{ textAlign: "center" }}>
          <div style={{ width: big, height: big, background: C.land, position: "relative", borderRadius: 8, overflow: "hidden" }}>
            {Array.from({ length: strips }).map((_, i) => {
              const done = sweep > i + 1;
              const active = sweep > i && sweep <= i + 1;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: (i * big) / strips,
                    height: big / strips - 3,
                    background: active ? C.sky : done ? "#1e3a5f" : "transparent",
                    opacity: active ? 0.9 : 1,
                  }}
                />
              );
            })}
          </div>
          <div style={{ color: C.dim, fontSize: 26, marginTop: 16 }}>10 m scene · 1,024 rows at a time</div>
        </div>
        <div style={{ color: C.amber, fontSize: 64, fontWeight: 800, opacity: appear(f, 20) }}>→</div>
        {/* 80 m output grid filling up */}
        <div style={{ textAlign: "center" }}>
          <div style={{ width: small, height: small, display: "grid", gridTemplateColumns: `repeat(${outCells}, 1fr)`, gap: 2 }}>
            {Array.from({ length: outCells * outCells }).map((_, k) => {
              const row = Math.floor(k / outCells);
              const filled = sweep * (outCells / strips) > row;
              return <div key={k} style={{ background: filled ? C.sky : C.land, borderRadius: 2 }} />;
            })}
          </div>
          <div style={{ color: C.dim, fontSize: 26, marginTop: 16 }}>8 × 8 average → 80 m</div>
          <div style={{ color: C.ink, fontSize: 26, marginTop: 4 }}>4,212 × 4,293 · 72 MB</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: wide ? 90 : 40, marginTop: 56, opacity: appear(f, 150) }}>
        {[
          ["44–65 s", "per pair of dates"],
          ["1.87–2.32 GB", "peak RAM"],
          ["4 cores", "normal PC"],
        ].map(([a, b]) => (
          <div key={a} style={{ textAlign: "center" }}>
            <div style={{ color: "#fff", fontSize: wide ? 54 : 40, fontWeight: 800 }}>{a}</div>
            <div style={{ color: C.dim, fontSize: 24 }}>{b}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 5. Two bands
const BANDS = [
  { img: "L.png", name: "L-band", km2: 1137.14, ac: 280993, color: C.ink },
  { img: "S.png", name: "S-band", km2: 1174.89, ac: 290322, color: C.ink },
  { img: "LS.png", name: "L + S", km2: 1337.15, ac: 330417, color: C.amber },
];

const Swatch: React.FC<{ color: string; text: string }> = ({ color, text }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 10, marginRight: 34 }}>
    <span style={{ width: 22, height: 22, background: color, borderRadius: 4, display: "inline-block" }} />
    {text}
  </span>
);

const Bands = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wide = useWide();
  const size = wide ? 470 : 310;
  return (
    <AbsoluteFill style={{ background: C.bg, opacity: fade(f, S.bands), fontFamily: FONT, alignItems: "center", justifyContent: "center" }}>
      <Label color={C.sky}>Newly detected water · 31 Aug → 12 Sep 2026</Label>
      <div style={{ display: "flex", gap: wide ? 40 : 24, marginTop: 30 }}>
        {BANDS.map((b, i) => {
          const s = spring({ frame: f - 10 - i * 14, fps, config: { damping: 200 } });
          const v = countUp(f, 40 + i * 14, 50, b.km2);
          const ac = countUp(f, 40 + i * 14, 50, b.ac);
          return (
            <div key={b.name} style={{ textAlign: "center", opacity: s, transform: `translateY(${(1 - s) * 40}px)` }}>
              <Img
                src={staticFile(b.img)}
                style={{ width: size, height: size, borderRadius: 10, border: i === 2 ? `4px solid ${C.amber}` : `4px solid ${C.land}` }}
              />
              <div style={{ color: b.color, fontSize: wide ? 34 : 28, fontWeight: 800, marginTop: 14 }}>{b.name}</div>
              <div style={{ color: "#fff", fontSize: wide ? 44 : 32, fontWeight: 800 }}>{fmt(v, 2)} km²</div>
              <div style={{ color: C.dim, fontSize: wide ? 24 : 20 }}>{fmt(ac)} acres</div>
            </div>
          );
        })}
      </div>
      <div style={{ color: C.ink, fontSize: wide ? 24 : 20, marginTop: 26, opacity: appear(f, 90) }}>
        <Swatch color={C.sky} text="stable water" />
        <Swatch color={C.orange} text="new water" />
        <Swatch color={C.teal} text="water loss" />
      </div>
      <div style={{ color: C.dim, fontSize: wide ? 22 : 18, marginTop: 10, opacity: appear(f, 100) }}>
        Same 40 km window · L and S taken seconds apart · 80 m grid
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 6. Season
const DATES = [
  { d: "26 Jul", km2: 213, ac: 52609 },
  { d: "31 Aug", km2: 617, ac: 152400 },
  { d: "12 Sep", km2: 812, ac: 200608 },
  { d: "18 Oct", km2: 299, ac: 73872 },
];

const Season = () => {
  const f = useCurrentFrame();
  const wide = useWide();
  const per = 46;
  const idx = Math.min(DATES.length - 1, Math.floor(Math.max(0, f - 10) / per));
  const size = wide ? 760 : 620;
  return (
    <AbsoluteFill style={{ background: C.bg, opacity: fade(f, S.season), fontFamily: FONT }}>
      <div style={{ display: "flex", flexDirection: wide ? "row" : "column", alignItems: "center", justifyContent: "center", height: "100%", gap: wide ? 80 : 26 }}>
        <div style={{ position: "relative", width: size, height: size, borderRadius: 10, overflow: "hidden" }}>
          {DATES.map((_, i) => {
            const o = interpolate(f, [10 + i * per - 8, 10 + i * per + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return <Img key={i} src={staticFile(`season${i}.png`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: i === 0 ? 1 : o }} />;
          })}
        </div>
        <div style={{ width: wide ? 640 : size }}>
          <Label color={C.sky}>One season, four L-band dates</Label>
          <div style={{ color: "#fff", fontSize: wide ? 120 : 78, fontWeight: 900, letterSpacing: -3, marginTop: 10 }}>{DATES[idx].d}</div>
          <div style={{ color: C.sky, fontSize: wide ? 60 : 44, fontWeight: 800 }}>{fmt(DATES[idx].km2)} km² dark water</div>
          <div style={{ color: C.dim, fontSize: wide ? 30 : 24 }}>{fmt(DATES[idx].ac)} acres · 40 km river window</div>
          <div style={{ display: "flex", gap: 10, marginTop: 30 }}>
            {DATES.map((d, i) => (
              <div key={d.d} style={{ flex: 1, height: 10, borderRadius: 5, background: i <= idx ? C.sky : C.land }} />
            ))}
          </div>
          {wide && (
            <div style={{ color: C.ink, fontSize: 28, marginTop: 30, opacity: appear(f, 10 + 3 * per) }}>
              Water rises to mid-September, then goes back.
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 7. Checked
const F1 = [
  { name: "L-band", v: 0.859, color: C.dim },
  { name: "S-band", v: 0.891, color: C.sky },
  { name: "L + S", v: 0.891, color: C.amber },
];

const Check = () => {
  const f = useCurrentFrame();
  const wide = useWide();
  const maxH = wide ? 360 : 380;
  return (
    <AbsoluteFill style={{ background: C.bg, opacity: fade(f, S.check), fontFamily: FONT, alignItems: "center", justifyContent: "center" }}>
      <Label color={C.green}>Checked against Sentinel-2</Label>
      <div style={{ color: "#fff", fontSize: wide ? 50 : 40, fontWeight: 800, marginTop: 12 }}>Water on 12 Sep 2026 · F1 score</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: wide ? 80 : 50, height: maxH + 60, marginTop: 30 }}>
        {F1.map((b, i) => {
          const h = interpolate(f, [14 + i * 8, 54 + i * 8], [0, b.v], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
          return (
            <div key={b.name} style={{ textAlign: "center" }}>
              <div style={{ color: "#fff", fontSize: 40, fontWeight: 800, marginBottom: 8 }}>{h.toFixed(3)}</div>
              <div style={{ width: wide ? 150 : 130, height: h * maxH, background: b.color, borderRadius: "8px 8px 0 0", margin: "0 auto" }} />
              <div style={{ color: C.ink, fontSize: 30, marginTop: 12 }}>{b.name}</div>
            </div>
          );
        })}
      </div>
      <div style={{ color: C.ink, fontSize: wide ? 32 : 28, marginTop: 30, opacity: appear(f, 70), textAlign: "center", padding: "0 60px" }}>
        L + S fixed L-band's mistakes. S-band alone was still as good.
      </div>
      <div style={{ color: C.dim, fontSize: 22, marginTop: 10, opacity: appear(f, 80) }}>
        Agreement on cloud-free pixels, not full accuracy
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 8. End
const End = () => {
  const f = useCurrentFrame();
  const wide = useWide();
  return (
    <AbsoluteFill style={{ opacity: fade(f, S.end, 12, 1) }}>
      <MapBackdrop len={S.end} dim={0.7} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", fontFamily: FONT }}>
        <div style={{ fontSize: wide ? 120 : 104, fontWeight: 900, color: "#fff", letterSpacing: -3, opacity: appear(f, 4) }}>
          NISAR <span style={{ color: C.sky }}>Pro</span>
        </div>
        <div style={{ fontSize: wide ? 40 : 34, color: C.ink, marginTop: 14, opacity: appear(f, 18), transform: `translateY(${rise(f, 18)}px)` }}>
          Open source · Runs on your own PC · Windows & Linux
        </div>
        <div
          style={{
            marginTop: 40,
            padding: "16px 34px",
            borderRadius: 14,
            background: "rgba(9,15,28,0.85)",
            border: `2px solid ${C.sky}`,
            color: "#fff",
            fontSize: wide ? 36 : 30,
            fontWeight: 700,
            opacity: appear(f, 34),
          }}
        >
          github.com/AdityaNarayanNayak-2/NISAR_PRO
        </div>
        <Label style={{ marginTop: 36, opacity: appear(f, 50) }} color={C.amber}>
          IEEE InGARSS 2026 · YP Hackathon
        </Label>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- timeline
export const Intro = () => {
  const order: [keyof typeof S, React.FC][] = [
    ["hook", Hook],
    ["title", Title],
    ["problem", Problem],
    ["engine", Engine],
    ["bands", Bands],
    ["season", Season],
    ["check", Check],
    ["end", End],
  ];
  let at = 0;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {order.map(([k, Comp]) => {
        const from = at;
        at += S[k];
        return (
          <Sequence key={k} from={from} durationInFrames={S[k]}>
            <Comp />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
