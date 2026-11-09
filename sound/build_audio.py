"""Soundtrack built in code: pulse on the 120 BPM grid, whoosh on every move, hit on the logo.
Reads shots.json for timing, writes out/soundtrack.wav at -14 LUFS (true peak <= -1 dBTP)."""
import json, pathlib
import numpy as np
from scipy.signal import butter, sosfilt, lfilter, fftconvolve, resample_poly
import pyloudnorm as pyln

ROOT = pathlib.Path(__file__).resolve().parent.parent
plan = json.loads((ROOT / 'shots.json').read_text())
SR, FPS = 48000, plan['fps']
N = int(plan['total_frames'] / FPS * SR)
rng = np.random.default_rng(20261203)          # fixed seed: identical every build
t_all = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)

def fr2s(fr): return int(round(fr / FPS * SR))
def add(sig, at, pan=0.0, gain=1.0):
    """mix mono or (2,n) signal at sample index `at` with constant-power pan (-1..1)"""
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4; sig = np.vstack([sig * np.cos(a), sig * np.sin(a)])
    n = min(sig.shape[1], N - at)
    if n <= 0: return
    L[at:at + n] += sig[0, :n] * gain; R[at:at + n] += sig[1, :n] * gain
def env_exp(n, tau): return np.exp(-np.arange(n) / (tau * SR))
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)

# ---------- pad: low A drone, dark and wide ----------
def saw(freq, t): return 2 * ((t * freq) % 1.0) - 1
pad = np.zeros((2, N))
for i, (f0, g) in enumerate([(55.0, .5), (82.41, .35), (110.0, .3), (164.81, .12)]):
    for ch, det in enumerate([-0.12, 0.12]):
        pad[ch] += g * saw(f0 + det * (i + 1), t_all + ch * 0.003)
cut = 380 + 220 * (0.5 - 0.5 * np.cos(2 * np.pi * t_all / 30))   # slow filter swell
pad = np.vstack([lp(lp(p, 700), 900) for p in pad])
swell = np.clip(t_all / 2.0, 0, 1) ** 2                           # fade in over 2 s (eased)
pad *= swell * 0.16
add(pad, 0)

# ---------- pulse: kick on every beat, hat on off-beats ----------
beat = SR * 60 / plan['bpm']
def kick(accent):
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 48 + 90 * np.exp(-t / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.09)
    click = hp(rng.standard_normal(n), 2500) * env_exp(n, 0.004) * 0.25 * np.clip(t / 0.001, 0, 1)
    return (s + click) * (1.0 if accent else 0.7)
def hat():
    n = int(0.08 * SR); return hp(rng.standard_normal(n), 7000, 4) * env_exp(n, 0.012) * 0.18
nb = int(N / beat)
for b in range(nb):
    at = int(b * beat); fr = at / SR * FPS
    if 1500 <= fr < 1560: continue                                # leave room for the logo hit
    g = 0.55 if fr >= 1560 else 1.0
    add(kick(b % 4 == 0), at, 0, 0.55 * g)
    add(hat(), int(at + beat / 2), 0.25 if b % 2 else -0.25, 0.5 * g)

# ---------- whoosh: filtered noise sweep, peak lands on the move ----------
def whoosh(dur, peak_at, big):
    n = int(dur * SR); x = rng.standard_normal(n)
    t = np.arange(n) / n; pk = peak_at / dur
    e = np.where(t < pk, (t / pk) ** 2.2, np.exp(-(t - pk) * 9 / (1 - pk)))
    lo = bp(x, 300, 1800, 2); hi = bp(x, 1800, 7000, 2)
    mix = np.clip((t - 0.1) / pk, 0, 1)                           # brighten into the peak
    s = (lo * (1 - mix) + hi * mix * 0.8) * e
    pan = np.linspace(-0.7, 0.7, n) if big else np.linspace(-0.3, 0.3, n)
    a = (pan + 1) * np.pi / 4
    return np.vstack([s * np.cos(a), s * np.sin(a)]) * (0.55 if big else 0.28)

moves = []
for s in plan['shots']:
    moves.append((s['in'], True))
    moves += [(l['in'], False) for l in s['lines']]
moves += [(270, False), (300, False), (1078, False), (1474, False), (1536, True), (1650, False)]  # tag snaps, ring, line move, logo move, button
seen = set()
for fr, big in sorted(moves):
    if fr in seen or fr == 1500: continue                        # the logo gets the hit, not a whoosh
    seen.add(fr)
    pre = 0.18 if big else 0.10
    at = max(0, fr2s(fr) - int(pre * SR)); peak = min(pre, fr2s(fr) / SR) or 0.02
    add(whoosh(0.55 if big else 0.32, peak, big), at)

# ---------- logo hit at the CTA shot ----------
hit_fr = next(s['in'] for s in plan['shots'] if s['id'] == 's7_cta')
n = int(3.0 * SR); t = np.arange(n) / SR
f = 34 + 70 * np.exp(-t / 0.05)
boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.45)
burst = bp(rng.standard_normal(n), 200, 6000) * env_exp(n, 0.05) * 0.5
shim = sum(np.sin(2 * np.pi * fq * t + ph) * a for fq, a, ph in [(880, .2, 0), (1318.5, .14, 1), (1760, .1, 2), (2637, .06, 3)])
shim = shim * env_exp(n, 0.9) * np.clip(t / 0.01, 0, 1)
hit = boom * 0.55 + lp(burst, 4000) * 0.6 + shim * 0.5
hit *= np.clip(t / 0.004, 0, 1) ** 2                            # 4 ms attack: no AAC overshoot on the hit
ir_n = int(1.8 * SR)
ir = np.vstack([rng.standard_normal(ir_n) * env_exp(ir_n, 0.45) for _ in range(2)]) * 0.03
wet = np.vstack([fftconvolve(hit, ir[c])[:n] for c in range(2)])
add(np.vstack([hit, hit]) * 0.9 + wet * 1.0, fr2s(hit_fr))

# ---------- master ----------
mix = np.vstack([L, R])
mix = hp(mix, 28)
mix = lp(mix, 15500, 8)                                           # AAC drops >16 kHz anyway; removing it first avoids encoder overshoot
fade = np.ones(N); k = int(0.45 * SR); fade[-k:] = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
mix *= fade
meter = pyln.Meter(SR)
def true_peak(x): return np.max(np.abs(resample_poly(x, 4, 1, axis=1)))
for _ in range(16):
    lufs = meter.integrated_loudness(mix.T)
    mix *= 10 ** ((-14 - lufs) / 20)
    tp = true_peak(mix)
    if tp <= 10 ** (-2.0 / 20): break                              # headroom for AAC overshoot
    th = 10 ** (-4 / 20)                                           # soft knee limiter above -4 dBFS
    a = np.abs(mix); over = a > th
    mix[over] = np.sign(mix[over]) * (th + (1 - th) * np.tanh((a[over] - th) / (1 - th)) * 0.86)
lufs = meter.integrated_loudness(mix.T); tp = 20 * np.log10(true_peak(mix))
out = ROOT / 'out' / 'soundtrack.wav'; out.parent.mkdir(exist_ok=True)
import wave
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f'{out}  {N / SR:.2f}s  {lufs:.2f} LUFS  true peak {tp:.2f} dBTP')
