// One full-canvas WebGL2 fragment shader: moulded bezel with a soft shadow, the scene
// sampled with nearest filtering, and the amber aviator-glass capsule knob.

const MARGIN = { x: 16, top: 12, bottom: 24 }; // scene px around the track (room for bezel and shadow)

const GLASS_VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const GLASS_FS = `#version 300 es
precision highp float;
uniform sampler2D uRail;
uniform sampler2D uFull;
uniform vec2 uRes;      // canvas size, device px
uniform float uScale;   // device px per scene px
uniform vec2 uOrigin;   // track top-left, device px
uniform vec2 uKnob;     // knob centre, scene px
uniform vec2 uKnobHalf; // knob half size after stretch, scene px
uniform float uNight;
uniform float uBezelNight; // bezel colour, driven separately so an embedding page can keep it dark
out vec4 outColor;

const vec2 SCENE = vec2(${W}.0, ${H}.0);
const float BEZEL = 6.0;
const float MAG = 0.78;     // UV scale inside the lens (≈1.28× magnification)
const float LOW = 5.5;      // sample slightly low so the whole car shows

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float sdTrack(vec2 p) { return sdRoundBox(p - SCENE * 0.5, SCENE * 0.5, SCENE.y * 0.5); }
float sdBezel(vec2 p) { return sdRoundBox(p - SCENE * 0.5, SCENE * 0.5 + BEZEL, SCENE.y * 0.5 + BEZEL); }
float sdKnob(vec2 p) { return sdRoundBox(p - uKnob, uKnobHalf, min(uKnobHalf.x, uKnobHalf.y)); }

vec3 fetch(sampler2D t, vec2 p) {
  ivec2 ip = ivec2(clamp(floor(p), vec2(0.0), SCENE - 1.0));
  return texelFetch(t, ip, 0).rgb;
}

vec2 gradK(vec2 p) {
  vec2 e = vec2(0.25, 0.0);
  return normalize(vec2(sdKnob(p + e.xy) - sdKnob(p - e.xy), sdKnob(p + e.yx) - sdKnob(p - e.yx)) + 1e-5);
}

void main() {
  vec2 dev = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = (dev - uOrigin) / uScale;
  float aa = 1.0 / uScale;

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // Soft drop shadow on the page, fading out well before the canvas edge.
  float dS = sdBezel(p - vec2(0.0, 5.0));
  float shadow = (1.0 - smoothstep(-4.0, 9.0, dS)) * 0.34;
  alpha = shadow;

  // Moulded bezel: cream by day, dark plum at night.
  float dB = sdBezel(p);
  vec3 bezDay = vec3(0.97, 0.93, 0.86);
  vec3 bezNight = vec3(0.22, 0.12, 0.24);
  vec3 bez = mix(bezDay, bezNight, uBezelNight);
  if (dB < aa) {
    float ringT = clamp(-dB / BEZEL, 0.0, 1.0);          // 0 outer edge → 1 inner edge
    float vy = (p.y - SCENE.y * 0.5) / (SCENE.y * 0.5 + BEZEL);
    float dome = sin(ringT * 3.14159);
    vec3 c = bez * (0.86 + 0.22 * dome - 0.16 * vy);
    c += vec3(1.0) * pow(max(0.0, -vy), 3.0) * smoothstep(0.0, 0.25, ringT) * (1.0 - ringT) * mix(0.35, 0.12, uBezelNight);
    c *= 1.0 - 0.25 * smoothstep(0.75, 1.0, ringT);       // lip toward the track
    float a = smoothstep(aa, -aa, dB);
    col = mix(col, c, a);
    alpha = mix(alpha, 1.0, a);
  }

  // The scene in the track.
  float dT = sdTrack(p);
  if (dT < aa) {
    vec3 sc = fetch(uRail, p);
    float topIn = clamp(p.y / 4.0, 0.0, 1.0);
    sc *= 0.72 + 0.28 * topIn;                              // inner shadow along the top
    sc *= 1.0 - 0.35 * smoothstep(-2.0, 0.0, dT);           // dark inner edge
    float dKS = sdKnob(p - vec2(1.5, 3.0));
    sc *= 1.0 - 0.38 * (1.0 - smoothstep(-3.0, 5.0, dKS));  // the knob's shadow on the room
    float a = smoothstep(aa, -aa, dT);
    col = mix(col, sc, a);
  }

  // Capsule knob of amber aviator glass, magnifying a fully lit render.
  float dK = sdKnob(p);
  if (dK < aa) {
    vec2 q = (p - uKnob) / uKnobHalf;
    float e = -dK;
    float rimT = 1.0 - smoothstep(0.0, 5.0, e);
    vec2 n = gradK(p);
    vec2 base = uKnob + vec2(0.0, LOW) + (p - uKnob) * MAG;
    vec2 bend = -n * rimT * rimT * 2.6;
    vec2 split = n * rimT * rimT * 1.6;
    vec3 g;
    g.r = fetch(uFull, base + bend + split).r;
    g.g = fetch(uFull, base + bend).g;
    g.b = fetch(uFull, base + bend - split).b;
    g *= 1.0 - 0.32 * smoothstep(0.35, 0.85, rimT);         // darker refraction band
    vec3 tintTop = vec3(0.36, 0.17, 0.04);
    vec3 tintBot = vec3(1.0, 0.8, 0.45);
    vec3 tint = mix(tintTop, tintBot, smoothstep(-1.0, 0.5, q.y));
    g *= mix(vec3(1.0), tint * 1.18, 0.85);
    g += vec3(1.0, 0.82, 0.55) * pow(rimT, 3.0) * 0.38;     // Fresnel edge
    g += vec3(1.0, 0.95, 0.85) * (1.0 - smoothstep(0.0, 1.1, e)) * 0.45;
    // Light focused at its foot: brightens what sits low in the lens (the car), plus a caustic.
    float pool = exp(-pow(q.x / 0.75, 2.0) - pow((q.y - 0.62) / 0.28, 2.0));
    float foot = exp(-pow(q.x / 0.55, 2.0) - pow((q.y - 0.86) / 0.09, 2.0));
    g *= 1.0 + pool * mix(0.35, 1.3, uNight);
    g += vec3(1.0, 0.72, 0.32) * foot * 0.5;
    float streak = exp(-pow((q.x + 0.52 + q.y * 0.12) / 0.11, 2.0)) * smoothstep(-0.92, -0.62, q.y) * smoothstep(0.05, -0.35, q.y);
    g += vec3(1.0) * streak * 0.55;
    float dot_ = exp(-dot(q - vec2(0.5, 0.64), q - vec2(0.5, 0.64)) / 0.004);
    g += vec3(1.0) * dot_ * 0.85;
    float a = smoothstep(aa, -aa, dK);
    col = mix(col, g, a);
    alpha = mix(alpha, 1.0, a);
  }

  outColor = vec4(col * alpha, alpha);
}`;

function createGlass(canvas) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return null;
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, GLASS_VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, GLASS_FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const makeTex = (unit) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  };
  const texRail = makeTex(0);
  const texFull = makeTex(1);
  const U = {};
  for (const name of ['uRail', 'uFull', 'uRes', 'uScale', 'uOrigin', 'uKnob', 'uKnobHalf', 'uNight', 'uBezelNight']) U[name] = gl.getUniformLocation(prog, name);
  gl.uniform1i(U.uRail, 0);
  gl.uniform1i(U.uFull, 1);

  const view = { scale: 1, origin: [0, 0], dpr: 1 };

  function resize(cssWidth) {
    const dpr = window.devicePixelRatio || 1;
    const cols = W + MARGIN.x * 2;
    const rows = H + MARGIN.top + MARGIN.bottom;
    const scale = Math.max(1, Math.floor((cssWidth * dpr) / cols));
    canvas.width = cols * scale;
    canvas.height = rows * scale;
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
    view.scale = scale;
    view.dpr = dpr;
    view.origin = [MARGIN.x * scale, MARGIN.top * scale];
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function draw(rail, full, knob, night, bezelNight = night) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texRail);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, rail);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texFull);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, full);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uScale, view.scale);
    gl.uniform2f(U.uOrigin, view.origin[0], view.origin[1]);
    gl.uniform2f(U.uKnob, knob.x, H / 2);
    gl.uniform2f(U.uKnobHalf, knob.hw, knob.hh);
    gl.uniform1f(U.uNight, night);
    gl.uniform1f(U.uBezelNight, bezelNight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // CSS pixel offset inside the canvas → scene pixel.
  function toScene(cssX, cssY) {
    return { x: (cssX * view.dpr - view.origin[0]) / view.scale, y: (cssY * view.dpr - view.origin[1]) / view.scale };
  }

  return { gl, resize, draw, toScene, view };
}

// Knob half-size: stretches horizontally with speed, squashing vertically to keep its volume.
function knobShape(k) {
  const s = 1 + k.stretch + k.wob.x;
  return { x: k.x, hw: (KNOB_W / 2) * s, hh: KNOB_H / 2 / s };
}

// Same rounded-box test as the shader's sdKnob, with a 1 px grace.
function insideKnob(k, x, y) {
  const sh = knobShape(k);
  const r = Math.min(sh.hw, sh.hh);
  const qx = Math.max(0, Math.abs(x - sh.x) - (sh.hw - r));
  const qy = Math.max(0, Math.abs(y - H / 2) - (sh.hh - r));
  return Math.hypot(qx, qy) <= r + 1;
}
