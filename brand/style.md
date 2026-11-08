# Clube do Financeiro — Style (vídeo de lançamento)

Fonte: scan com Playwright de clubedofinanceiro.com.br e /lista/ em 2026-11-08.
O vídeo segue a linguagem da página **/lista/** (escura, ciano, Michroma + Exo 2), não a home (clara, com amarelo).

## Paleta (3 cores principais)

| Token | Hex | Origem | Uso |
|---|---|---|---|
| `--cdf-black` | `#0A0C0E` | fundo /lista/ | fundo de todos os shots |
| `--cdf-cyan` | `#1FB6DE` | destaque /lista/ (botão, "lista de espera") | palavra-chave, linhas, glow, CTA |
| `--cdf-white` | `#F2F5F7` | texto /lista/ | texto principal |

Apoio (só derivações das 3 acima, já presentes no site/logo):

| Token | Hex | Uso |
|---|---|---|
| `--cdf-cyan-hi` | `#4FD1F0` | topo do gradiente do botão, brilho |
| `--cdf-cyan-logo` | `#03ABE5` | símbolo do logo (não recolorir) |
| `--cdf-surface` | `#15181B` | cards / painéis |
| `--cdf-line` | `#262B30` | grid, bordas |
| `--cdf-muted` | `#7A858F` | legendas, URL |
| `--cdf-cyan-08` | `rgba(31,182,222,.08)` | preenchimento de selo |
| `--cdf-cyan-35` | `rgba(31,182,222,.35)` | borda de selo / glow |

Proibido no vídeo: amarelo `#FFDA45` e teal `#087E9A` da home (quebram o "ciano no preto").

## Tipografia (máx. 2 famílias, ambas OFL, em `brand/fonts/`)

- **Michroma** — títulos, selos, números. Sempre com tracking aberto em caixa alta.
- **Exo 2** (variável, 400–700) — frases de apoio, listas, URL.

Escala (px; 16:9 = 1920×1080 · 9:16 = 1080×1920):

| Papel | Família | 16:9 | 9:16 | Tracking | Caixa |
|---|---|---|---|---|---|
| Display (hook, CTA) | Michroma 400 | 88 | 76 | -0.01em | mista |
| Título | Michroma 400 | 64 | 58 | 0 | mista |
| Item de lista | Exo 2 600 | 48 | 46 | 0 | mista |
| Apoio | Exo 2 400 | 34 | 34 | 0 | mista |
| Selo / eyebrow | Michroma 400 | 22 | 22 | 0.24em | CAIXA ALTA |
| URL | Exo 2 500 | 30 | 32 | 0.02em | minúscula |

Line-height: Michroma 1.15 · Exo 2 1.3. Largura máx. de linha: 1500 px (16:9) / 920 px (9:16).
Safe area: 96 px laterais (16:9); 9:16 usa 80 px laterais, 220 px topo, 320 px base (UI de Reels/Shorts).

## Logo

- `logo/cdf_logo_dark.png` — símbolo ciano + "CLUBE DO FINANCEIRO" em `#F2F5F7` (derivado de `LOGO_CDF_V2-10.png`, só o letreiro recolorido).
- `logo/cdf_mark.png` — só o símbolo, para transições/watermark.
- Originais: `LOGO_CDF_V2-10.png` (fundo claro), `LOGO_CDF_V2-12.png` (branco total).
- Respiro mínimo: altura do "F" do símbolo em volta. Nunca distorcer, nunca glow colorido além do ciano.

## Telas de produto (`screens/`)

01 hero /lista/ · 02 card CDF · 03 card CDF Plus · 04 formulário · 05 seção do clube (home, fundo claro — usar só com moldura escura ou evitar).

## Motion

Tempo: **120 BPM = 30 frames por batida a 60 fps**. Cortes caem na batida.

| Curva | GSAP | Uso |
|---|---|---|
| Entrada | `expo.out` | texto, cards, logo (18–30 f) |
| Movimento | `power2.inOut` | câmera, deslocar blocos (24–40 f) |
| Saída | `expo.in` | sair de cena (12–16 f) |
| Linha/traço | `power3.out` | desenhar linhas e sublinhados (20 f) |

Regras:
- Nada linear (exceto o drift de fundo, que é seno com período ≥ 6 s).
- Texto entra **por palavra**, stagger de 4 f, deslocamento y 40 px + blur 8→0 px.
- Movimentos sobrepõem 4–6 f (o próximo começa antes do anterior terminar).
- Cada quadro-chave legível fica parado **≥ 18 f** (meta: ≥ 45 f para frases).
- Transição entre shots: wipe de linha ciana de 2 px ou push de 6 f; nunca dissolve longo.
- Fundo: preto com grid `--cdf-line` a 6% e um glow radial ciano a 10% que se desloca devagar.
- Determinismo: timeline GSAP pausada, `tl.seek(frame/60)`; ruído/partículas com PRNG de seed fixa (mulberry32).

## Som

Pulso a 120 BPM; whoosh em cada movimento; hit grave + brilho no logo; master em -14 LUFS.
