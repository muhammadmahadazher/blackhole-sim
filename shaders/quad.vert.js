// ============================================================================
//  quad.vert.js  —  Fullscreen-quad vertex shader (GLSL ES 3.00 / WebGL2)
//  Every render pass (black-hole, bloom, composite) draws one triangle/quad
//  that covers the screen; all the real work happens in the fragment shaders.
// ============================================================================
window.BH = window.BH || {};
window.BH.shaders = window.BH.shaders || {};

window.BH.shaders.quadVert = `#version 300 es
precision highp float;

in vec2 aPos;          // clip-space position in [-1, 1]
out vec2 vUv;          // 0..1 UV handed to the fragment shader

void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
