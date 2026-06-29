// ============================================================================
//  main.js  —  Orchestrator: WebGL2 context, GPU detection, adaptive quality,
//              render pipeline, frame loop, and UI/drawer wiring.
// ============================================================================
(function () {
    "use strict";
    const S = window.BH.shaders;
    const Phys = window.BH.Physics;

    const canvas = document.getElementById("scene");
    const gl = canvas.getContext("webgl2", {
        antialias: false, alpha: false, depth: false,
        powerPreference: "high-performance", preserveDrawingBuffer: true
    });
    if (!gl) { document.getElementById("nowebgl").style.display = "flex"; return; }
    const floatOK = !!gl.getExtension("EXT_color_buffer_float");

    // ---- GPU detection + tiers -------------------------------------------
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const rawGpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl.getParameter(gl.RENDERER) || "Unknown");
    function cleanName(s) {
        let n = s;
        if (/angle \(/i.test(n)) n = n.replace(/^.*?angle \(/i, "").replace(/\)\s*$/, "");
        n = n.split(",").map(t => t.trim()).sort((a, b) => b.length - a.length)[0] || n;
        return n.replace(/\(0x[0-9a-f]+\)/ig, "").replace(/\((r|tm)\)/ig, "")
                .replace(/direct3d.*$/i, "").replace(/d3d\d+.*$/i, "").replace(/vs_\d+.*$/i, "")
                .replace(/\s{2,}/g, " ").trim() || s;
    }
    function classifyGpu(s) {
        const r = s.toLowerCase();
        if (/swiftshader|llvmpipe|software|microsoft basic|warp/.test(r)) return "potato";
        if (/apple m\d|apple gpu/.test(r)) return "high";
        if (/rtx|geforce gtx 1[6-9]|geforce rtx|geforce gtx 10|radeon rx|radeon pro|quadro|arc a\d|titan/.test(r)) return "high";
        if (/nvidia|geforce|radeon|firepro|vega/.test(r)) return "medium";
        if (/iris xe|iris plus|iris pro|arc graphics/.test(r)) return "medium";
        if (/intel|uhd|hd graphics|mali|adreno|powervr|vivante|videocore/.test(r)) return "low";
        return "medium";
    }
    const tier = classifyGpu(rawGpu);
    const TIER_LABEL = { potato: "Software / very weak", low: "Integrated GPU", medium: "Mid-range GPU", high: "High-end GPU" };
    const TIERS = {
        potato: { dpr: 1.0, scaleMin: 0.35, scaleMax: 0.50, stepsMin: 90,  stepsMax: 140, target: 30 },
        low:    { dpr: 1.0, scaleMin: 0.45, scaleMax: 0.70, stepsMin: 130, stepsMax: 210, target: 42 },
        medium: { dpr: 1.25,scaleMin: 0.60, scaleMax: 0.90, stepsMin: 200, stepsMax: 340, target: 52 },
        high:   { dpr: 2.0, scaleMin: 0.80, scaleMax: 1.00, stepsMin: 340, stepsMax: 600, target: 60 }
    };
    const QUAL = {
        battery:  { scale: 0.45, steps: 120, fpsCap: 30, dpr: 1.0 },
        balanced: { scale: 0.70, steps: 220, fpsCap: 60, dpr: 1.0 },
        quality:  { scale: 1.00, steps: 440, fpsCap: 60, dpr: 1.5 },
        ultra:    { scale: 1.35, steps: 640, fpsCap: 60, dpr: 2.0 }
    };
    const tcfg = TIERS[tier];

    // ---- programs / targets ----------------------------------------------
    const G = window.BH.gl;
    const progScene  = G.createProgram(gl, S.quadVert, S.blackholeFrag);
    const progBright = G.createProgram(gl, S.quadVert, S.brightFrag);
    const progBlur   = G.createProgram(gl, S.quadVert, S.blurFrag);
    const progComp   = G.createProgram(gl, S.quadVert, S.compositeFrag);
    const progLine   = G.createProgram(gl, S.lineVert, S.lineFrag);
    const quad = G.createFullscreenQuad(gl);

    // ---- photon-path line overlay ----
    const lineVAO = gl.createVertexArray();
    const linePosBuf = gl.createBuffer(), lineColBuf = gl.createBuffer();
    let lineCount = 0, lastRays = -1;
    (function () {
        const aP = gl.getAttribLocation(progLine, "aPos"), aC = gl.getAttribLocation(progLine, "aCol");
        gl.bindVertexArray(lineVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, linePosBuf); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineColBuf); gl.enableVertexAttribArray(aC); gl.vertexAttribPointer(aC, 3, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
    })();
    function mat4mul(a, b) {
        const o = new Float32Array(16);
        for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k]; o[c*4+r] = s; }
        return o;
    }
    function viewProjMatrix(cam, aspect) {
        const e = cam.pos, r = cam.right, u = cam.up, f = cam.forward, z = [-f[0], -f[1], -f[2]];
        const view = new Float32Array([
            r[0], u[0], z[0], 0,  r[1], u[1], z[1], 0,  r[2], u[2], z[2], 0,
            -(r[0]*e[0]+r[1]*e[1]+r[2]*e[2]), -(u[0]*e[0]+u[1]*e[1]+u[2]*e[2]), -(z[0]*e[0]+z[1]*e[1]+z[2]*e[2]), 1
        ]);
        const fy = 1 / cam.tanHalfFov, near = 0.05, far = Math.max(200, cam.radius * 4);
        const proj = new Float32Array([ fy/aspect, 0, 0, 0,  0, fy, 0, 0,  0, 0, (far+near)/(near-far), -1,  0, 0, (2*far*near)/(near-far), 0 ]);
        return mat4mul(proj, view);
    }
    let scene, bloomA, bloomB, renderW = 1, renderH = 1, bloomW = 1, bloomH = 1;
    function allocTargets(w, h) {
        renderW = Math.max(2, w | 0); renderH = Math.max(2, h | 0);
        bloomW = Math.max(2, renderW >> 1); bloomH = Math.max(2, renderH >> 1);
        if (!scene) { scene = G.createTarget(gl, renderW, renderH, floatOK); bloomA = G.createTarget(gl, bloomW, bloomH, floatOK); bloomB = G.createTarget(gl, bloomW, bloomH, floatOK); }
        else { G.resizeTarget(gl, scene, renderW, renderH, floatOK); G.resizeTarget(gl, bloomA, bloomW, bloomH, floatOK); G.resizeTarget(gl, bloomB, bloomW, bloomH, floatOK); }
    }

    // ---- camera, objects, UI ---------------------------------------------
    const camera = window.BH.Camera(canvas);
    const objects = window.BH.Objects();
    let lastCam = null;
    const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
    function aimAtCenter() {
        const p = lastCam ? lastCam.pos : [0, 0, 22];
        const d = norm([-p[0], -p[1], -p[2]]); const j = 0.2;
        return norm([d[0]+(Math.random()-0.5)*j, d[1]+(Math.random()-0.5)*j, d[2]+(Math.random()-0.5)*j]);
    }
    function throwOne() { if (lastCam) objects.spawn(lastCam.pos, aimAtCenter(), P.throwSpeed); }
    function burstThrow() { if (lastCam) for (let i = 0; i < 6; i++) objects.spawn(lastCam.pos, aimAtCenter(), P.throwSpeed * (0.8 + Math.random()*0.5)); }
    function clearObjs() { objects.clear(); }
    function throwAt(x, y) {
        if (!lastCam) return;
        const rect = canvas.getBoundingClientRect();
        const nx = ((x - rect.left) / rect.width) * 2 - 1, ny = -(((y - rect.top) / rect.height) * 2 - 1);
        const aspect = canvas.width / canvas.height, t = lastCam.tanHalfFov, f = lastCam.forward, r = lastCam.right, u = lastCam.up;
        objects.spawn(lastCam.pos, norm([f[0]+nx*aspect*t*r[0]+ny*t*u[0], f[1]+nx*aspect*t*r[1]+ny*t*u[1], f[2]+nx*aspect*t*r[2]+ny*t*u[2]]), P.throwSpeed);
    }
    function onParam() { if (ui) ui.refreshReadouts(); }

    const ui = window.BH.UI(camera, {
        onQuality: setQuality, onCinematic: toggleCinematic,
        onThrow: throwOne, onBurst: burstThrow, onClearObjects: clearObjs,
        onParamChange: onParam
    });
    const P = ui.params;
    const runtime = { scale: 0.6, steps: 180 };

    function rebuildPhotons() {
        const d = window.BH.Photons.compute({ rays: P.photonRays | 0, bMax: 7.0 });
        gl.bindBuffer(gl.ARRAY_BUFFER, linePosBuf); gl.bufferData(gl.ARRAY_BUFFER, d.positions, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineColBuf); gl.bufferData(gl.ARRAY_BUFFER, d.colors, gl.DYNAMIC_DRAW);
        lineCount = d.count; lastRays = P.photonRays | 0;
    }

    function setQuality(mode) {
        P.qualityMode = mode;
        if (mode === "auto") {
            P.auto = true; P.dprCap = tcfg.dpr; P.targetFps = tcfg.target; P.fpsCap = 60;
            runtime.scale = (tcfg.scaleMin + tcfg.scaleMax) * 0.5; runtime.steps = Math.round((tcfg.stepsMin + tcfg.stepsMax) * 0.5);
            ui.setPerfNote("Auto adjusts detail to hold ~" + tcfg.target + " fps. No manual tuning needed.");
        } else {
            P.auto = false; const q = QUAL[mode]; P.dprCap = q.dpr; P.fpsCap = q.fpsCap; runtime.scale = q.scale; runtime.steps = q.steps;
            ui.setPerfNote("Fixed: " + Math.round(q.scale * 100) + "% resolution · " + q.steps + " steps · " + q.fpsCap + " fps cap.");
        }
        P.resScale = runtime.scale; P.steps = runtime.steps;
        ui.setActiveQuality(mode); if (ui.setPerfSliders) ui.setPerfSliders(P.targetFps, P.fpsCap); forceResize();
    }

    // ---- resize ----------------------------------------------------------
    let curDpr = 1;
    function computeDpr() { return Math.min(window.devicePixelRatio || 1, P.dprCap || 1); }
    function resize() {
        curDpr = computeDpr();
        const cssW = canvas.clientWidth || window.innerWidth, cssH = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.round(cssW * curDpr); canvas.height = Math.round(cssH * curDpr);
        allocTargets(canvas.width * runtime.scale, canvas.height * runtime.scale);
    }
    function forceResize() { resize(); }
    window.addEventListener("resize", resize);

    // ---- app bar / drawer / input ----------------------------------------
    const body = document.body, sidebar = document.getElementById("sidebar");
    const drawer = document.getElementById("drawer"), scrim = document.getElementById("drawerScrim");
    function toggleCinematic() { body.classList.toggle("cinematic"); }
    function openDrawer() { drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); scrim.classList.add("show"); }
    function closeDrawer() { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); scrim.classList.remove("show"); }
    function screenshot() { const a = document.createElement("a"); a.download = "blackhole_" + Math.floor(performance.now()) + ".png"; a.href = canvas.toDataURL("image/png"); a.click(); }

    // welcome / onboarding overlay (first run, remembered)
    const welcome = document.getElementById("welcome");
    function showWelcome() { welcome.classList.add("show"); }
    function hideWelcome() { welcome.classList.remove("show"); try { localStorage.setItem("bh_welcomed", "1"); } catch (e) {} }
    document.getElementById("btn-help").addEventListener("click", showWelcome);
    document.getElementById("welcome-close").addEventListener("click", hideWelcome);
    document.getElementById("welcome-start").addEventListener("click", hideWelcome);
    welcome.addEventListener("click", (e) => { if (e.target === welcome) hideWelcome(); });

    document.getElementById("btn-learn").addEventListener("click", () => drawer.classList.contains("open") ? closeDrawer() : openDrawer());
    document.getElementById("drawer-close").addEventListener("click", closeDrawer);
    scrim.addEventListener("click", closeDrawer);
    document.getElementById("btn-throw").addEventListener("click", throwOne);
    document.getElementById("btn-cine").addEventListener("click", toggleCinematic);
    document.getElementById("btn-shot").addEventListener("click", screenshot);
    document.getElementById("btn-panel").addEventListener("click", () => sidebar.classList.toggle("hidden"));

    window.addEventListener("keydown", (e) => {
        if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
        if (e.key === "h" || e.key === "H") sidebar.classList.toggle("hidden");
        if (e.key === "c" || e.key === "C") toggleCinematic();
        if (e.key === "l" || e.key === "L") drawer.classList.contains("open") ? closeDrawer() : openDrawer();
        if (e.key === "r" || e.key === "R") camera.reset();
        if (e.key === "t" || e.key === "T") throwOne();
        if (e.key === " ") { P.autoRotate = !P.autoRotate; camera.setAutoRotate(P.autoRotate); }
        if (e.key === "p" || e.key === "P") screenshot();
        if (e.key === "Escape") { body.classList.remove("cinematic"); closeDrawer(); hideWelcome(); }
    });
    let downX = 0, downY = 0, downMoved = false;
    canvas.addEventListener("mousedown", (e) => { downX = e.clientX; downY = e.clientY; downMoved = false; });
    canvas.addEventListener("mousemove", (e) => { if ((e.buttons & 1) && Math.hypot(e.clientX - downX, e.clientY - downY) > 6) downMoved = true; });
    canvas.addEventListener("click", (e) => { if (!downMoved && P.clickThrow) throwAt(e.clientX, e.clientY); });

    // ---- adaptive quality ------------------------------------------------
    let emaFps = 60, adjTimer = 0;
    function adapt(dt, fpsNow) {
        emaFps += (fpsNow - emaFps) * 0.12; adjTimer += dt;
        if (!P.auto || adjTimer < 0.55) return; adjTimer = 0;
        const t = P.targetFps;
        if (emaFps < t - 6) {
            if (runtime.scale > tcfg.scaleMin) runtime.scale = Math.max(tcfg.scaleMin, runtime.scale - 0.06);
            else if (runtime.steps > tcfg.stepsMin) runtime.steps = Math.max(tcfg.stepsMin, runtime.steps - 25);
            P.resScale = runtime.scale; P.steps = runtime.steps; reallocIfNeeded();
        } else if (emaFps > t + 9) {
            if (runtime.steps < tcfg.stepsMax) runtime.steps = Math.min(tcfg.stepsMax, runtime.steps + 18);
            else if (runtime.scale < tcfg.scaleMax) runtime.scale = Math.min(tcfg.scaleMax, runtime.scale + 0.04);
            P.resScale = runtime.scale; P.steps = runtime.steps; reallocIfNeeded();
        }
    }
    function reallocIfNeeded() {
        const w = Math.round(canvas.width * runtime.scale), h = Math.round(canvas.height * runtime.scale);
        if (w !== renderW || h !== renderH) allocTargets(w, h);
    }

    // ---- draw helpers ----------------------------------------------------
    function drawQuad() { gl.bindVertexArray(quad); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); }
    function bindTarget(t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null); if (t) gl.viewport(0, 0, t.w, t.h); else gl.viewport(0, 0, canvas.width, canvas.height); }
    const fpsEl = document.getElementById("sb-fps");
    let hudT = 0, liveT = 0;

    function render(dt, now) {
        if (Math.abs(computeDpr() - curDpr) > 0.01) resize();
        const cam = camera.update(dt); lastCam = cam;

        objects.setConfig("timeScale", P.objTimeScale); objects.setConfig("radius", P.objSize);
        objects.update(dt); const od = objects.uniforms();

        const aAbs = ui.aAbs(), pro = ui.prograde();
        const horizonR = Phys.horizonRs(aAbs), photonR = Phys.photonSphereRs(aAbs, pro);

        // ---- pass 1: geodesic ray march ----
        bindTarget(scene); gl.useProgram(progScene);
        gl.uniform2f(progScene.uni("uResolution"), scene.w, scene.h);
        gl.uniform3fv(progScene.uni("uCamPos"), cam.pos);
        gl.uniform3fv(progScene.uni("uCamRight"), cam.right);
        gl.uniform3fv(progScene.uni("uCamUp"), cam.up);
        gl.uniform3fv(progScene.uni("uCamForward"), cam.forward);
        gl.uniform1f(progScene.uni("uTanHalfFov"), cam.tanHalfFov);
        gl.uniform1f(progScene.uni("uTime"), now * 0.001);
        gl.uniform1i(progScene.uni("uSteps"), runtime.steps | 0);
        gl.uniform1f(progScene.uni("uStepScale"), 1.0);
        gl.uniform1f(progScene.uni("uEscapeR"), Math.max(60.0, cam.radius * 2.2));
        gl.uniform1f(progScene.uni("uDiskInner"), P.diskInner);
        gl.uniform1f(progScene.uni("uDiskOuter"), P.diskOuter);
        gl.uniform1f(progScene.uni("uDiskBright"), P.diskBright);
        gl.uniform1f(progScene.uni("uDiskTemp"), P.diskTemp);
        gl.uniform1f(progScene.uni("uDiskAlpha"), P.diskAlpha);
        gl.uniform1f(progScene.uni("uDopplerShift"), P.dopplerShift ? 1 : 0);
        gl.uniform1f(progScene.uni("uBeaming"), P.beaming ? 1 : 0);
        gl.uniform1f(progScene.uni("uGravRedshift"), P.gravRedshift ? 1 : 0);
        gl.uniform1f(progScene.uni("uLensing"), P.lensing ? 1 : 0);
        gl.uniform1f(progScene.uni("uBgBright"), P.bgBright);
        gl.uniform1f(progScene.uni("uStarDensity"), P.starDensity);
        gl.uniform1f(progScene.uni("uHorizonR"), horizonR);
        gl.uniform1f(progScene.uni("uPhotonR"), photonR);
        gl.uniform1f(progScene.uni("uIscoR"), P.diskInner);
        gl.uniform1f(progScene.uni("uOvHorizon"), P.ovHorizon ? 1 : 0);
        gl.uniform1f(progScene.uni("uOvPhoton"), P.ovPhoton ? 1 : 0);
        gl.uniform1f(progScene.uni("uOvISCO"), P.ovISCO ? 1 : 0);
        gl.uniform1f(progScene.uni("uOvErgo"), P.ovErgo ? 1 : 0);
        gl.uniform1f(progScene.uni("uAnnotate"), P.annotate ? 0.7 : 0);
        gl.uniform1i(progScene.uni("uObjCount"), od.count);
        if (od.count > 0) { gl.uniform3fv(progScene.uni("uObjPos"), od.pos); gl.uniform3fv(progScene.uni("uObjCol"), od.col); gl.uniform4fv(progScene.uni("uObjParam"), od.par); }
        drawQuad();

        // ---- pass 2: bright ----
        bindTarget(bloomA); gl.useProgram(progBright);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex);
        gl.uniform1i(progBright.uni("uScene"), 0); gl.uniform1f(progBright.uni("uThreshold"), P.bloomThreshold); drawQuad();
        // ---- pass 3: blur ----
        for (let i = 0; i < 2; i++) {
            bindTarget(bloomB); gl.useProgram(progBlur);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bloomA.tex);
            gl.uniform1i(progBlur.uni("uTex"), 0); gl.uniform2f(progBlur.uni("uTexel"), 1 / bloomW, 1 / bloomH);
            gl.uniform2f(progBlur.uni("uDir"), 1, 0); drawQuad();
            bindTarget(bloomA); gl.bindTexture(gl.TEXTURE_2D, bloomB.tex); gl.uniform2f(progBlur.uni("uDir"), 0, 1); drawQuad();
        }
        // ---- pass 4: composite ----
        bindTarget(null); gl.useProgram(progComp);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex); gl.uniform1i(progComp.uni("uScene"), 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomA.tex); gl.uniform1i(progComp.uni("uBloom"), 1);
        gl.uniform1f(progComp.uni("uBloomStrength"), P.bloomStrength);
        gl.uniform1f(progComp.uni("uExposure"), P.exposure);
        gl.uniform1f(progComp.uni("uVignette"), P.vignette);
        gl.uniform1f(progComp.uni("uChroma"), P.chroma);
        gl.uniform1f(progComp.uni("uSaturation"), P.saturation);
        gl.uniform1f(progComp.uni("uGrade"), P.grade);
        gl.uniform1f(progComp.uni("uTime"), now * 0.001);
        drawQuad();

        // ---- photon-path overlay (3D lines over the composited scene) ----
        if (P.photonPaths) {
            if (lineCount === 0 || (P.photonRays | 0) !== lastRays) rebuildPhotons();
            const vp = viewProjMatrix(cam, canvas.width / canvas.height);
            gl.useProgram(progLine);
            gl.uniformMatrix4fv(progLine.uni("uViewProj"), false, vp);
            gl.uniform1f(progLine.uni("uAlpha"), 0.9);
            gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            gl.bindVertexArray(lineVAO); gl.drawArrays(gl.LINES, 0, lineCount); gl.bindVertexArray(null);
            gl.disable(gl.BLEND);
        }

        // ---- stats / live readouts ----
        const fpsNow = dt > 0 ? 1 / dt : 60; adapt(dt, fpsNow);
        hudT += dt; liveT += dt;
        if (liveT >= 0.2) { liveT = 0; ui.refreshLive(cam.radius); }
        if (hudT >= 0.4 && fpsEl) {
            hudT = 0;
            fpsEl.textContent = `${Math.round(emaFps)} fps · ${renderW}×${renderH} @ ${Math.round(runtime.scale*100)}% · ${runtime.steps} steps`;
        }
    }

    // ---- frame loop: FPS cap + tab-hidden pause --------------------------
    let running = true, rafId = 0, lastT = performance.now(), lastDraw = 0;
    function loop(now) {
        if (!running) return;
        rafId = requestAnimationFrame(loop);
        const minInterval = 1000 / P.fpsCap - 0.7;
        if (now - lastDraw < minInterval) return;
        let dt = (now - lastT) / 1000; lastT = now; lastDraw = now;
        if (dt > 0.1 || !dt) dt = 0.016;
        render(dt, now);
    }
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) { running = false; if (rafId) cancelAnimationFrame(rafId); }
        else if (!running) { running = true; lastT = performance.now(); lastDraw = 0; rafId = requestAnimationFrame(loop); }
    });

    // ---- go --------------------------------------------------------------
    ui.setGpu(cleanName(rawGpu), TIER_LABEL[tier], tier);
    if (tier === "low" || tier === "potato") {
        const warn = document.getElementById("gpu-warn"), modal = document.getElementById("gpu-modal");
        if (warn) {
            warn.style.display = "flex";
            const nm = warn.querySelector("#gpu-warn-name"); if (nm) nm.textContent = cleanName(rawGpu);
            warn.querySelector("#gpu-fix").addEventListener("click", () => { if (modal) modal.style.display = "flex"; });
            warn.querySelector("#gpu-dismiss").addEventListener("click", () => { warn.style.display = "none"; });
        }
        if (modal) { modal.querySelector("#gpu-modal-close").addEventListener("click", () => modal.style.display = "none");
            modal.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; }); }
    }
    setQuality("auto");
    try { if (!localStorage.getItem("bh_welcomed")) showWelcome(); } catch (e) { showWelcome(); }
    rafId = requestAnimationFrame(loop);
    console.log("Black Hole Explorer — GPU:", cleanName(rawGpu), "| tier:", tier, "| HDR:", floatOK);
})();
