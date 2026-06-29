// ============================================================================
//  post.frag.js  —  Post-processing fragment shaders (GLSL ES 3.00)
//    brightFrag    : extract HDR highlights (bright-pass) + downsample
//    blurFrag      : separable Gaussian blur (run H then V, a few times)
//    compositeFrag : add bloom to the scene, ACES tone-map, gamma-correct,
//                    subtle vignette + filmic grain
//  Together these give the accretion disk / photon ring their luminous glow,
//  the way real over-exposed astronomical imagery blooms.
// ============================================================================
window.BH = window.BH || {};
window.BH.shaders = window.BH.shaders || {};

// ---- bright-pass ----------------------------------------------------------
window.BH.shaders.brightFrag = `#version 300 es
precision highp float;
in  vec2 vUv;
out vec4 fragColor;
uniform sampler2D uScene;
uniform float uThreshold;
void main(){
    vec3 c = texture(uScene, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float k = max(0.0, l - uThreshold) / max(l, 1e-4);
    fragColor = vec4(c * k, 1.0);
}
`;

// ---- separable Gaussian blur ---------------------------------------------
window.BH.shaders.blurFrag = `#version 300 es
precision highp float;
in  vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2  uTexel;      // 1.0 / textureSize
uniform vec2  uDir;        // (1,0) horizontal or (0,1) vertical
void main(){
    float w[5];
    w[0]=0.227027; w[1]=0.194595; w[2]=0.121622; w[3]=0.054054; w[4]=0.016216;
    vec3 r = texture(uTex, vUv).rgb * w[0];
    for(int i=1;i<5;i++){
        vec2 off = uTexel * uDir * float(i) * 1.5;
        r += texture(uTex, vUv + off).rgb * w[i];
        r += texture(uTex, vUv - off).rgb * w[i];
    }
    fragColor = vec4(r, 1.0);
}
`;

// ---- photon-path line overlay (3D coloured lines over the scene) ---------
window.BH.shaders.lineVert = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aCol;
uniform mat4 uViewProj;
out vec3 vCol;
void main() {
    vCol = aCol;
    gl_Position = uViewProj * vec4(aPos, 1.0);
}
`;
window.BH.shaders.lineFrag = `#version 300 es
precision highp float;
in  vec3 vCol;
out vec4 fragColor;
uniform float uAlpha;
void main() { fragColor = vec4(vCol, uAlpha); }
`;

// ---- final composite + tone map + cinematic grade ------------------------
window.BH.shaders.compositeFrag = `#version 300 es
precision highp float;
in  vec2 vUv;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uTime;
uniform float uVignette;
uniform float uChroma;       // chromatic aberration amount
uniform float uSaturation;   // colour saturation
uniform float uGrade;        // teal-shadows / warm-highlights strength

// ACES filmic tone-mapping (Narkowicz fit)
vec3 aces(vec3 x){
    const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }

vec3 sampleHDR(vec2 uv){
    return texture(uScene, uv).rgb + texture(uBloom, uv).rgb * uBloomStrength;
}

void main(){
    vec2 q = vUv - 0.5;

    // chromatic aberration grows toward the edges (lens-like)
    vec2 off = q * (uChroma * 0.012 * dot(q, q) * 4.0);
    vec3 col;
    col.r = sampleHDR(vUv + off).r;
    col.g = sampleHDR(vUv).g;
    col.b = sampleHDR(vUv - off).b;

    col *= uExposure;
    col = aces(col);

    // saturation
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma), col, uSaturation);

    // cinematic grade: cool shadows, warm highlights
    vec3 shadowTint = vec3(-0.03, 0.0, 0.05);
    vec3 highTint   = vec3(0.05, 0.02, -0.04);
    col += mix(shadowTint, highTint, smoothstep(0.0, 0.8, luma)) * uGrade;

    // vignette
    float vig = 1.0 - uVignette * dot(q, q) * 1.9;
    col *= clamp(vig, 0.0, 1.0);

    // gamma
    col = pow(max(col, 0.0), vec3(1.0/2.2));

    // faint film grain to break up banding
    float g = hash(vUv + fract(uTime)) - 0.5;
    col += g * 0.012;

    fragColor = vec4(col, 1.0);
}
`;
