// ============================================================================
//  ui.js  —  Accordion control panel, real-unit inputs, live scientific
//            readouts, thermodynamics, presets, the info/explainer popover,
//            and the Learn drawer. Builds everything into #panel.
// ============================================================================
window.BH = window.BH || {};

window.BH.UI = function (camera, hooks) {
    "use strict";
    hooks = hooks || {};
    const P_ = window.BH.Physics;
    const panel = document.getElementById("panel");
    const popover = document.getElementById("popover");

    // ---- live parameters --------------------------------------------------
    const params = {
        // performance (set by main.setQuality after GPU detect)
        qualityMode: "auto", auto: true, targetFps: 45, fpsCap: 60, dprCap: 1.0,
        resScale: 0.6, steps: 180,
        // black hole (physical)
        M: 4.297e6, spin: 0.5, incl: 40, fEdd: 1e-4, distLy: 26996,
        // disk
        diskInner: 2.12, diskOuter: 12, diskBright: 1.0, diskTemp: 9500, diskAlpha: 0.92,
        // relativistic effect toggles
        lensing: true, dopplerShift: true, beaming: true, gravRedshift: true,
        // geometry overlays
        ovHorizon: false, ovPhoton: false, ovISCO: false, ovErgo: false, annotate: false,
        photonPaths: false, photonRays: 21,
        // background
        bgBright: 1.0, starDensity: 1.0,
        // image / cinematic
        exposure: 1.0, bloomStrength: 0.9, bloomThreshold: 1.3, vignette: 0.5,
        saturation: 1.12, chroma: 0.12, grade: 0.45, fov: 55,
        // camera
        autoRotate: true, autoSpeed: 0.05,
        // thrown matter
        throwSpeed: 7.0, objSize: 0.45, objTimeScale: 2.5, clickThrow: true
    };
    const prograde = () => params.spin >= 0;
    const aAbs = () => Math.min(0.998, Math.abs(params.spin));

    function recomputeGeometry() {
        params.diskInner = P_.iscoRs(aAbs(), prograde());
    }

    // ---- info / explainer popover ----------------------------------------
    const LEARN_BY_ID = {};
    (window.BH.LEARN || []).forEach(t => LEARN_BY_ID[t.id] = t);
    let popoverAnchor = null;
    function showInfo(anchor, topicId) {
        const t = LEARN_BY_ID[topicId];
        if (!t) return;
        popover.innerHTML = `<h4>${t.title}</h4>${t.body}` +
            (t.formula ? `<span class="eq">${t.formula}</span>` : "") +
            (t.numbers ? `<span class="src">${t.numbers}</span>` : "");
        const r = anchor.getBoundingClientRect();
        popover.style.left = Math.max(12, Math.min(window.innerWidth - 312, r.left - 280)) + "px";
        popover.style.top = Math.min(window.innerHeight - 20, r.bottom + 8) + "px";
        popover.classList.add("show");
        popoverAnchor = anchor;
    }
    function hideInfo() { popover.classList.remove("show"); popoverAnchor = null; }
    document.addEventListener("click", (e) => {
        if (popoverAnchor && e.target !== popoverAnchor && !popover.contains(e.target)) hideInfo();
    });

    function infoBtn(topicId) {
        const b = document.createElement("button");
        b.className = "info-i"; b.textContent = "i"; b.title = "What is this?";
        b.addEventListener("click", (e) => { e.stopPropagation(); showInfo(b, topicId); });
        return b;
    }

    // ---- control builders -------------------------------------------------
    function section(title, accent, open) {
        const s = document.createElement("div");
        s.className = "section" + (open ? " open" : "");
        s.dataset.accent = accent;
        const head = document.createElement("button");
        head.className = "section-head";
        head.setAttribute("aria-expanded", open ? "true" : "false");
        head.innerHTML = `<span class="dot"></span><span class="title">${title}</span><span class="chev">▼</span>`;
        const body = document.createElement("div");
        body.className = "section-body";
        head.addEventListener("click", () => { const o = s.classList.toggle("open"); head.setAttribute("aria-expanded", o ? "true" : "false"); });
        s.appendChild(head); s.appendChild(body); panel.appendChild(s);
        return body;
    }
    function lin(v, a, b) { return a + (b - a) * v; }
    function invlin(x, a, b) { return (x - a) / (b - a); }
    function slider(parent, opts) {
        // opts: {label, key, min, max, step, fmt, log, onInput, info}
        const row = document.createElement("div"); row.className = "ctl";
        const head = document.createElement("div"); head.className = "ctl-head";
        const lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = opts.label;
        if (opts.info) lbl.appendChild(infoBtn(opts.info));
        const val = document.createElement("span"); val.className = "val";
        const input = document.createElement("input"); input.type = "range";
        const L = opts.log;
        if (L) { input.min = 0; input.max = 1; input.step = 0.0001;
                 input.value = invlin(Math.log10(params[opts.key]), Math.log10(opts.min), Math.log10(opts.max)); }
        else   { input.min = opts.min; input.max = opts.max; input.step = opts.step; input.value = params[opts.key]; }
        const render = () => { val.textContent = opts.fmt ? opts.fmt(params[opts.key]) : params[opts.key]; };
        render();
        input.addEventListener("input", () => {
            params[opts.key] = L ? Math.pow(10, lin(parseFloat(input.value), Math.log10(opts.min), Math.log10(opts.max)))
                                 : parseFloat(input.value);
            render(); if (opts.onInput) opts.onInput(params[opts.key]);
            if (hooks.onParamChange) hooks.onParamChange();
        });
        head.appendChild(lbl); head.appendChild(val); row.appendChild(head); row.appendChild(input);
        parent.appendChild(row);
        return { set: (v) => { params[opts.key] = v;
            input.value = L ? invlin(Math.log10(v), Math.log10(opts.min), Math.log10(opts.max)) : v; render(); } };
    }
    function switchCtl(parent, label, key, info, onChange) {
        const row = document.createElement("label"); row.className = "switch";
        const lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = label;
        if (info) lbl.appendChild(infoBtn(info));
        const input = document.createElement("input"); input.type = "checkbox"; input.checked = !!params[key];
        input.addEventListener("change", () => { params[key] = input.checked; if (onChange) onChange(input.checked); if (hooks.onParamChange) hooks.onParamChange(); });
        row.appendChild(lbl); row.appendChild(input); parent.appendChild(row);
        return { set: (v) => { params[key] = v; input.checked = !!v; } };
    }
    function button(parent, label, solid, onClick) {
        const b = document.createElement("button"); b.className = "btn" + (solid ? " solid" : "");
        b.textContent = label; b.addEventListener("click", onClick); parent.appendChild(b); return b;
    }
    function note(parent, html) { const d = document.createElement("div"); d.className = "note"; d.innerHTML = html; parent.appendChild(d); return d; }

    // readout grid helpers
    function grid(parent) { const g = document.createElement("div"); g.className = "readouts"; parent.appendChild(g); return g; }
    function ro(g, label, info) {
        const k = document.createElement("div"); k.className = "ro-k"; k.textContent = label;
        if (info) k.appendChild(infoBtn(info));
        const v = document.createElement("div"); v.className = "ro-v"; v.textContent = "—";
        g.appendChild(k); g.appendChild(v); return v;
    }
    function divider(g) { const d = document.createElement("div"); d.className = "ro-divider"; g.appendChild(d); }

    // =====================================================================
    //  Build the panel
    // =====================================================================

    // ---- 1. Black hole (physical inputs + presets) ----
    const gBH = section("Black hole", "blackhole", true);
    const selRow = document.createElement("select"); selRow.className = "sel";
    Object.keys(window.BH.PRESETS).forEach(n => { const o = document.createElement("option"); o.value = n; o.textContent = n; selRow.appendChild(o); });
    selRow.value = "Sgr A* — Milky Way";
    selRow.addEventListener("change", () => applyPreset(selRow.value));
    gBH.appendChild(selRow);
    const citeEl = note(gBH, "");
    citeEl.className = "cite";

    const sM = slider(gBH, { label: "Mass", key: "M", min: 1, max: 1e10, log: true, fmt: v => P_.fmtMass(v), info: "populations" });
    const sSpin = slider(gBH, { label: "Spin a✶", key: "spin", min: -0.998, max: 0.998, step: 0.002,
        fmt: v => (v >= 0 ? "+" : "") + v.toFixed(3) + (Math.abs(v) < 0.02 ? "" : v > 0 ? " (prograde)" : " (retro)"),
        onInput: () => { recomputeGeometry(); refreshReadouts(); }, info: "kerr" });
    const sIncl = slider(gBH, { label: "Inclination", key: "incl", min: 0, max: 90, step: 1, fmt: v => v.toFixed(0) + "°  (0 = face-on)",
        onInput: (v) => { camera.state.tElevation = (90 - v) * Math.PI / 180 * 0.99; }, info: "eht" });
    const sEdd = slider(gBH, { label: "Accretion (Eddington)", key: "fEdd", min: 1e-4, max: 2, log: true,
        fmt: v => v >= 1 ? v.toFixed(2) + "× ⚠" : v.toExponential(1) + "×", info: "disk" });
    const sDist = slider(gBH, { label: "Distance", key: "distLy", min: 10, max: 5e10, log: true, fmt: v => P_.fmtLength(v * P_.LY), info: "eht" });

    // ---- 2. Live readouts ----
    const gRO = section("Live readouts", "observation", true);
    note(gRO, "Computed from the mass, spin &amp; distance above — change them and watch every quantity update.");
    const rg = grid(gRO);
    const roRs = ro(rg, "Schwarzschild radius rₛ", "horizon");
    const roHor = ro(rg, "Outer horizon r₊", "kerr");
    const roPh = ro(rg, "Photon sphere", "photonring");
    const roISCO = ro(rg, "ISCO (disk inner edge)", "isco");
    const roErg = ro(rg, "Ergosphere (equator)", "kerr");
    divider(rg);
    const roShadow = ro(rg, "Shadow diameter", "horizon");
    const roThetaG = ro(rg, "Gravitational radius θg", "eht");
    const roBeta = ro(rg, "ISCO orbital speed", "isco");
    const roEff = ro(rg, "Radiative efficiency", "isco");
    const roDiskT = ro(rg, "Peak disk temperature", "disk");
    const roTd = ro(rg, "Time dilation (view pt.)", "timedilation");

    // ---- 3. Accretion disk ----
    const gDisk = section("Accretion disk", "accretion", false);
    note(gDisk, "Inner edge is the spin-dependent ISCO. Colour temperature is artistic; the <b>physical</b> peak T is in the readouts (real disks shine in UV/X-ray).");
    const sDiskOuter = slider(gDisk, { label: "Outer radius", key: "diskOuter", min: 6, max: 40, step: 0.5, fmt: v => v.toFixed(1) + " rₛ" });
    slider(gDisk, { label: "Brightness", key: "diskBright", min: 0, max: 3, step: 0.05, fmt: v => v.toFixed(2) });
    const sDiskTemp = slider(gDisk, { label: "Colour temperature", key: "diskTemp", min: 3000, max: 16000, step: 100, fmt: v => (v/1000).toFixed(1) + "k K" });
    slider(gDisk, { label: "Gas opacity", key: "diskAlpha", min: 0.2, max: 1, step: 0.02, fmt: v => v.toFixed(2) });

    // ---- 4. Relativistic effects ----
    const gRel = section("Relativistic effects", "relativity", false);
    note(gRel, "Toggle each effect to see exactly what it contributes. Turn <b>lensing</b> off for flat-space (no GR) — a dramatic before/after.");
    switchCtl(gRel, "Gravitational lensing", "lensing", "lensing");
    switchCtl(gRel, "Doppler colour shift", "dopplerShift", "beaming");
    const swBeam = switchCtl(gRel, "Relativistic beaming", "beaming", "beaming");
    switchCtl(gRel, "Gravitational redshift", "gravRedshift", "timedilation");

    // ---- 5. Geometry & overlays ----
    const gGeo = section("Geometry & overlays", "spacetime", false);
    note(gGeo, "Draw the invisible relativistic surfaces in the equatorial plane to see the structure spin reshapes.");
    switchCtl(gGeo, "Annotated mode (labels)", "annotate", "horizon");
    switchCtl(gGeo, "Event horizon r₊", "ovHorizon", "horizon");
    switchCtl(gGeo, "Photon sphere", "ovPhoton", "photonring");
    switchCtl(gGeo, "ISCO ring", "ovISCO", "isco");
    switchCtl(gGeo, "Ergosphere", "ovErgo", "kerr");
    switchCtl(gGeo, "Photon paths (light bending)", "photonPaths", "photonring");
    note(gGeo, 'A fan of light rays traced through curved spacetime. ' +
        '<b style="color:#ff5e5e">Red</b> = captured · ' +
        '<b style="color:#a99cff">violet</b> = orbiting (near b_c≈2.6 rₛ) · ' +
        '<b style="color:#2ED3C6">cyan</b> = escaping. Tip: set inclination → 0 (face-on) &amp; dim the disk to see the bending clearly.');
    slider(gGeo, { label: "Number of rays", key: "photonRays", min: 5, max: 41, step: 2, fmt: v => v.toFixed(0) });

    // ---- 6. Thermodynamics ----
    const gThermo = section("Thermodynamics", "thermo", false);
    note(gThermo, "Quantum + gravity: smaller holes are <b>hotter</b>, entropy scales with horizon <b>area</b>, lifetime with M³.");
    const tg = grid(gThermo);
    const roTH = ro(tg, "Hawking temperature", "hawking");
    const roEnt = ro(tg, "Entropy (Bekenstein–Hawking)", "entropy");
    const roEvap = ro(tg, "Evaporation lifetime", "hawking");
    const roPow = ro(tg, "Hawking power", "hawking");
    const roVsCMB = ro(tg, "vs CMB (2.725 K)", "hawking");

    // ---- 7. Probes & matter ----
    const gThrow = section("Probes & infalling matter", "spacetime", false);
    note(gThrow, "Click the scene (or press <b>T</b>) to hurl a probe at the hole — watch it spaghettify, redshift &amp; freeze at the horizon.", "tidal");
    const throwRow = document.createElement("div"); throwRow.className = "btn-row";
    button(throwRow, "🪐 Throw", false, () => hooks.onThrow && hooks.onThrow());
    button(throwRow, "✦ Burst", false, () => hooks.onBurst && hooks.onBurst());
    button(throwRow, "Clear", false, () => hooks.onClearObjects && hooks.onClearObjects());
    gThrow.appendChild(throwRow);
    slider(gThrow, { label: "Throw speed", key: "throwSpeed", min: 2, max: 16, step: 0.5, fmt: v => v.toFixed(1) });
    slider(gThrow, { label: "Object size", key: "objSize", min: 0.15, max: 1.2, step: 0.05, fmt: v => v.toFixed(2) + " rₛ" });
    slider(gThrow, { label: "Fall speed (time)", key: "objTimeScale", min: 0.5, max: 6, step: 0.1, fmt: v => v.toFixed(1) + "×" });
    switchCtl(gThrow, "Click scene to throw", "clickThrow");

    // ---- 8. Scene & sky ----
    const gSky = section("Scene & sky", "observation", false);
    slider(gSky, { label: "Star brightness", key: "bgBright", min: 0, max: 3, step: 0.05, fmt: v => v.toFixed(2) });
    slider(gSky, { label: "Star density", key: "starDensity", min: 0, max: 2, step: 0.05, fmt: v => v.toFixed(2) });

    // ---- 9. Image & view ----
    const gImg = section("Image & view", "camera", false);
    slider(gImg, { label: "Exposure", key: "exposure", min: 0.2, max: 3, step: 0.05, fmt: v => v.toFixed(2) });
    slider(gImg, { label: "Bloom", key: "bloomStrength", min: 0, max: 3, step: 0.05, fmt: v => v.toFixed(2) });
    slider(gImg, { label: "Saturation", key: "saturation", min: 0.4, max: 1.8, step: 0.02, fmt: v => v.toFixed(2) });
    slider(gImg, { label: "Chromatic aberration", key: "chroma", min: 0, max: 1.5, step: 0.05, fmt: v => v.toFixed(2) });
    slider(gImg, { label: "Colour grade", key: "grade", min: 0, max: 1.5, step: 0.05, fmt: v => v.toFixed(2) });
    slider(gImg, { label: "Vignette", key: "vignette", min: 0, max: 1.5, step: 0.05, fmt: v => v.toFixed(2) });
    slider(gImg, { label: "Field of view", key: "fov", min: 30, max: 100, step: 1, fmt: v => v.toFixed(0) + "°", onInput: () => camera.setFov(params.fov) });
    switchCtl(gImg, "Auto-rotate", "autoRotate", null, b => camera.setAutoRotate(b));
    slider(gImg, { label: "Rotate speed", key: "autoSpeed", min: 0, max: 0.4, step: 0.01, fmt: v => v.toFixed(2), onInput: () => camera.setAutoSpeed(params.autoSpeed) });
    button(gImg, "Reset view", false, () => camera.reset());

    // ---- 10. Performance ----
    const gPerf = section("Performance", "performance", false);
    const badge = document.createElement("div"); badge.className = "gpu-badge";
    badge.innerHTML = `<span class="gdot"></span><div><b id="gpu-name">Detecting GPU…</b><small id="gpu-tier"></small></div>`;
    gPerf.appendChild(badge);
    const seg = document.createElement("div"); seg.className = "seg";
    const segBtns = {};
    [["auto","Auto"],["battery","Battery"],["balanced","Balanced"],["quality","Quality"],["ultra","Ultra"]].forEach(([m,l]) => {
        const b = document.createElement("button"); b.textContent = l; b.dataset.mode = m;
        b.addEventListener("click", () => hooks.onQuality && hooks.onQuality(m)); seg.appendChild(b); segBtns[m] = b;
    });
    gPerf.appendChild(seg);
    const perfNote = note(gPerf, "Auto adjusts detail to hold a smooth frame-rate.");
    const sTarget = slider(gPerf, { label: "Target FPS (Auto)", key: "targetFps", min: 24, max: 60, step: 1, fmt: v => v.toFixed(0) });
    const sFps = slider(gPerf, { label: "Max FPS cap", key: "fpsCap", min: 24, max: 120, step: 1, fmt: v => v.toFixed(0) });
    function setPerfSliders(t, f) { sTarget.set(t); sFps.set(f); }

    // =====================================================================
    //  Presets
    // =====================================================================
    function applyPreset(name) {
        const p = window.BH.PRESETS[name]; if (!p) return;
        params.M = p.M; params.spin = p.spin; params.incl = p.incl; params.fEdd = p.fEdd;
        params.distLy = p.distLy > 0 ? p.distLy : 26996;
        params.diskOuter = p.diskOuter; params.diskTemp = p.diskTemp; params.beaming = p.beaming;
        recomputeGeometry();
        sM.set(p.M); sSpin.set(p.spin); sIncl.set(p.incl); sEdd.set(p.fEdd); sDist.set(params.distLy);
        sDiskOuter.set(p.diskOuter); sDiskTemp.set(p.diskTemp); swBeam.set(p.beaming);
        if (p.view) { camera.state.tRadius = p.view.radiusRs; camera.setFov(p.view.fovDeg); params.fov = p.view.fovDeg; }
        camera.state.tElevation = (90 - p.incl) * Math.PI / 180 * 0.99;
        citeEl.innerHTML = "Source: " + p.cite + (p.ringUas ? `<br>EHT-measured ring: <b style="color:var(--accent-on)">${p.ringUas} µas</b>` : "");
        refreshReadouts();
    }

    // =====================================================================
    //  Readout refresh
    // =====================================================================
    function refreshReadouts() {
        const s = P_.summary(params.M, aAbs(), params.distLy, prograde(), params.fEdd);
        const rsKm = P_.rsMeters(params.M) / 1000;
        roRs.innerHTML = P_.fmtLength(P_.rsMeters(params.M));
        roHor.innerHTML = P_.horizonRs(aAbs()).toFixed(3) + " rₛ <small>" + P_.fmtLength(s.horizonKm * 1000) + "</small>";
        roPh.textContent = s.photonRs.toFixed(3) + " rₛ";
        roISCO.innerHTML = s.iscoRs.toFixed(3) + " rₛ <small>" + P_.fmtLength(s.iscoKm * 1000) + "</small>";
        roErg.textContent = s.ergoEqRs.toFixed(2) + " rₛ";
        roShadow.innerHTML = (s.shadowUas >= 0.01 ? s.shadowUas.toPrecision(3) : s.shadowUas.toExponential(2)) + " µas <small>6√3 θg</small>";
        roThetaG.textContent = (s.shadowUas / 10.392 >= 0.01 ? (s.shadowUas / 10.392).toPrecision(3) : (s.shadowUas / 10.392).toExponential(2)) + " µas";
        roBeta.textContent = s.iscoBeta.toFixed(3) + " c";
        roEff.textContent = (s.efficiency * 100).toFixed(1) + " %";
        roDiskT.innerHTML = P_.fmtSci(s.diskPeakK, "K") + " <small>" + tempBand(s.diskPeakK) + "</small>";
        roTd.textContent = "—";
        // thermo
        roTH.innerHTML = P_.fmtSci(s.hawkingK, "K");
        roEnt.innerHTML = P_.fmtSci(s.entropyKB) + " <small>k_B</small>";
        roEvap.textContent = P_.fmtTime(s.evaporationYr);
        roPow.innerHTML = P_.fmtSci(hawkingPower(params.M), "W");
        roVsCMB.innerHTML = (s.hawkingK > 2.725)
            ? `<span style="color:var(--status-warn)">${(s.hawkingK/2.725).toPrecision(2)}× hotter</span>`
            : `<span style="color:var(--status-info)">${(2.725/s.hawkingK).toExponential(1)}× colder</span>`;
        // status bar metric
        const sb = document.getElementById("sb-metric");
        if (sb) sb.textContent = `${prograde() ? "Kerr" : "Kerr (retro)"}  a✶=${Math.abs(params.spin).toFixed(2)}  ·  M=${P_.fmtMass(params.M)}`;
        // Eddington warning
        setStatus(params.fEdd >= 1 ? "warn" : "ok", params.fEdd >= 1 ? "Super-Eddington accretion" : "ready");
    }
    function hawkingPower(M) { // W:  ħc⁶/(15360π G² M²)
        const Mkg = M * P_.MSUN;
        return P_.HBAR * Math.pow(P_.C, 6) / (15360 * Math.PI * P_.G * P_.G * Mkg * Mkg);
    }
    function tempBand(T) {
        if (T > 1e7) return "X-ray"; if (T > 3e4) return "UV"; if (T > 1e4) return "blue-white";
        if (T > 5e3) return "white"; return "warm/optical";
    }
    function setStatus(kind, text) {
        const dot = document.getElementById("sb-dot"), st = document.getElementById("sb-state");
        if (!dot) return;
        const c = { ok: "var(--status-ok)", warn: "var(--status-warn)", error: "var(--status-error)", info: "var(--status-info)" }[kind] || "var(--status-ok)";
        dot.style.background = c; dot.style.color = c; st.textContent = text;
    }

    // live (per-frame-ish) readouts that depend on camera
    function refreshLive(camRadiusRs) {
        roTd.textContent = camRadiusRs > 1 ? P_.timeDilation(camRadiusRs).toFixed(3) + "× " : "frozen";
    }

    // =====================================================================
    //  Learn drawer
    // =====================================================================
    function buildDrawer() {
        const body = document.getElementById("drawer-body");
        const secs = window.BH.LEARN_SECTIONS || {};
        const accentFor = { spacetime: "spacetime", relativity: "relativity", accretion: "accretion", thermo: "thermo", observation: "observation" };
        Object.keys(secs).forEach(secKey => {
            (window.BH.LEARN || []).filter(t => t.section === secKey).forEach(t => {
                const c = document.createElement("div");
                c.className = "section"; c.dataset.accent = accentFor[secKey] || "observation";
                const card = document.createElement("div"); card.className = "learn-card";
                card.innerHTML = `<div class="tag">${secs[secKey]}</div><h3>${t.title}</h3>` +
                    `<p>${t.body}</p><p class="analogy">${t.analogy}</p>` +
                    (t.formula ? `<span class="eq">${t.formula}</span>` : "") +
                    (t.numbers ? `<span class="nums">${t.numbers}</span>` : "");
                c.appendChild(card); body.appendChild(c);
            });
        });
    }
    buildDrawer();

    // =====================================================================
    //  Perf hooks for main
    // =====================================================================
    function setActiveQuality(mode) { Object.entries(segBtns).forEach(([m, b]) => b.classList.toggle("active", m === mode)); }
    function setGpu(name, tierLabel, tierClass) {
        badge.querySelector("#gpu-name").textContent = name;
        badge.querySelector("#gpu-tier").textContent = tierLabel;
        badge.className = "gpu-badge tier-" + tierClass;
    }
    function setPerfNote(t) { perfNote.textContent = t; }

    // init
    recomputeGeometry();
    applyPreset("Sgr A* — Milky Way");
    camera.setAutoRotate(params.autoRotate);
    camera.setAutoSpeed(params.autoSpeed);
    camera.setFov(params.fov);
    refreshReadouts();

    return {
        params, applyPreset, refreshReadouts, refreshLive, setActiveQuality, setGpu, setPerfNote, setStatus,
        setPerfSliders, aAbs, prograde
    };
};
