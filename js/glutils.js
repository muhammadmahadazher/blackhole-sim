// ============================================================================
//  glutils.js  —  Minimal WebGL2 helpers (no external dependencies)
//    * shader compile + program link with readable error reporting
//    * a single fullscreen-quad VAO reused by every pass
//    * HDR float render targets (with graceful fallback to 8-bit)
// ============================================================================
window.BH = window.BH || {};

window.BH.gl = (function () {
    "use strict";

    function createShader(gl, type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(sh);
            const kind = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
            console.error(`[${kind} shader]\n` + log + "\n--- source ---\n" + withLineNumbers(src));
            throw new Error(`Failed to compile ${kind} shader: ${log}`);
        }
        return sh;
    }

    function withLineNumbers(src) {
        return src.split("\n").map((l, i) => String(i + 1).padStart(4) + " | " + l).join("\n");
    }

    function createProgram(gl, vsSrc, fsSrc) {
        const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
        const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.bindAttribLocation(prog, 0, "aPos");
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error("Program link error: " + gl.getProgramInfoLog(prog));
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        // cache uniform locations lazily
        const cache = {};
        prog.uni = function (name) {
            if (!(name in cache)) cache[name] = gl.getUniformLocation(prog, name);
            return cache[name];
        };
        return prog;
    }

    // One big triangle covering clip space [-1,1]; cheaper than a quad.
    function createFullscreenQuad(gl) {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        return vao;
    }

    // A render target.  Tries 16-bit float; falls back to 8-bit if the GPU
    // can't render to float (very rare on modern hardware).
    function createTarget(gl, w, h, floatOK) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        const internal = floatOK ? gl.RGBA16F : gl.RGBA8;
        const type = floatOK ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { tex, fbo, w, h };
    }

    function resizeTarget(gl, t, w, h, floatOK) {
        t.w = w; t.h = h;
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        const internal = floatOK ? gl.RGBA16F : gl.RGBA8;
        const type = floatOK ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
    }

    return { createProgram, createFullscreenQuad, createTarget, resizeTarget };
})();
