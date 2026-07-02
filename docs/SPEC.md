# elecxarium — 仕様書 (SPEC)

> Microsoft *.NET Terrarium* へのオマージュ。ユーザが書いた生き物（creature）のコードを
> サンドボックス化した Web Worker 上で走らせ、ひとつのエコシステムで競わせる対戦シミュレータ。
> ローカルは Vite(+Electron)、Web は静的サイトとして配信する。

- **Status:** Draft v0.2（設計レビュー反映）
- **確定済みの基本方針:**
  1. ゲームモデル = **エコシステム（Terrarium 忠実）** — 繁殖・個体数変動・食物連鎖あり
  2. 世界 = **連続2D平面 ＋ 離散ティック**
  3. Creature API = **純粋な脳関数 `defineCreature<TMemory>({ traits, think })`**
  4. UI = **React + Tailwind + Monaco**

### v0.2 設計レビュー所見と対応

| # | 所見 | 対応 |
|---|---|---|
| 1 | Worker 内 `import '@elecxarium/creature'` が解決不能（CSP で eval 不可・require をブロック済） | **require allowlist ＋ harness 文字列**で解決（§4.5） |
| 2 | 近傍探索が素朴だと O(N²) | **uniform grid 空間インデックス**（§6.1） |
| 3 | 「重なり解消」が曖昧 | **距離ベース相互作用**に単純化（ハード衝突なし） |
| 4 | `Memory` 型が弱い | `defineCreature<TMemory>` で**ジェネリック推論**、`Sense` は全 `readonly`（§5） |
| 5 | 決定論: 超越関数がエンジン間で非一致 | engine は四則+`sqrt`中心、注意を明記（§7） |
| 6 | UI/UX が抽象的 | モダンスタック具体化（§9）: Tailwind v4(OKLCH)/Radix/motion/lucide/resizable-panels/reduced-motion |
| 7 | 品質基盤の欠落 | ESLint(flat)+Prettier+EditorConfig+CI、strict 追加フラグ、React error boundary（§10/§11） |
| 8 | 初期スポーンの有利不利 | **種ごと対称スポーン**（§6.1） |
| 9 | sim と rAF の結合 | sim は**固定ステップ accumulator**、描画は rAF 補間で分離（§8） |

---

## 目次

1. [ビジョンと差別化ポイント](#1-ビジョンと差別化ポイント)
2. [用語](#2-用語)
3. [アーキテクチャ](#3-アーキテクチャ)
4. [サンドボックスとセキュリティ](#4-サンドボックスとセキュリティ)
5. [Creature API（公開コントラクト）](#5-creature-api公開コントラクト)
6. [シミュレーション規則](#6-シミュレーション規則)
7. [決定論とリプレイ](#7-決定論とリプレイ)
8. [レンダリング](#8-レンダリング)
9. [UI/UX](#9-uiux)
10. [プロジェクト構成](#10-プロジェクト構成)
11. [技術スタック](#11-技術スタック)
12. [ビルドとデプロイ](#12-ビルドとデプロイ)
13. [チューニング定数](#13-チューニング定数デフォルト)
14. [マイルストーン](#14-マイルストーン)
15. [将来拡張・未決事項](#15-将来拡張未決事項)
16. [付録: オリジナル Terrarium との対応表](#16-付録-オリジナル-terrarium-との対応表)

---

## 1. ビジョンと差別化ポイント

プレイヤーはアプリのテキストボックス（Monaco エディタ）に **TypeScript で生き物を1種**書いて貼り付ける。
アプリはそれを `sucrase` でビルドし、**種ごとに専用の Web Worker** で実行。共有のシミュレーション
エンジンが毎ティック各個体に「感覚情報（sense）」を渡し、Worker が「行動（action）」を返す。
エンジンはそれを権威的に解決し、複数ユーザのコードを同じ世界で競わせる。

**Terrarium の設計制約は Worker サンドボックスで自然に強制できる**点が本プロジェクトの肝。

| Terrarium の制約 | 現代の実現手段 |
|---|---|
| 1個体あたり 2〜5ms の思考時間制限 | Worker の per-tick タイムアウト → 超過で `terminate()` |
| 他個体は読み取り専用 `State` でしか見えない | `postMessage` の構造化複製（値渡し） |
| イベント駆動・長時間ループ禁止 | 1ティック1回 `think()` 呼び出し（純粋関数） |
| I/O 全面禁止（.NET CAS サンドボックス） | Web Worker + CSP（`fetch`/`fs`/`eval` 不能） |
| 持ち点で能力をトレードオフ | `traits` の合計を `TRAIT_BUDGET` 以下に制約 |

→ かつて CAS で苦労して作ったサンドボックスを、**Worker+CSP がほぼタダで**提供する。

---

## 2. 用語

| 用語 | 意味 |
|---|---|
| **Creature / Species（種）** | ユーザが書く1つの定義（`defineCreature(...)`）。1ユーザ = 1種 |
| **Organism / Individual（個体）** | 種からスポーンされた世界上の実体。同種は複数個体存在しうる |
| **Role（ロール）** | `herbivore`（草食）/ `carnivore`（肉食）/ `plant`（植物＝静止・光合成のプログラマブル種）。背景植物も自動生成 |
| **Tick（ティック）** | シミュレーションの離散ステップ。世界更新の最小単位 |
| **Sense** | ある個体がそのティックに観測できる読み取り専用スナップショット |
| **Action** | `think()` が返す、その個体のそのティックの行動 |
| **Memory** | 個体ごとの永続メモリ。ティックを跨いで保持（Worker 内に存在） |
| **Carcass（死骸）** | 死亡した動物が残す食料。肉食が食べられる。一定時間で消滅 |

---

## 3. アーキテクチャ

スレッド3層構成（`elecxzy` のサンドボックス ＋ `steel-ignition` のコア純粋化を折衷）。

```
┌─ Main / UI thread (React) ─────────────────────────────────────────┐
│  Monaco Editors(タブ×種)   SVG Arena   Leaderboard / Controls       │
│        │貼付コード              ▲snapshot(補間描画)                  │
│        ▼                        │                                   │
│  sandbox/compile (sucrase)      │                                   │
│        │compiledJS              │                                   │
│        ▼                        │                                   │
│  sandbox/brainHost ──► Brain Worker (種A) ─┐                        │
│   (per種のWorker管理) ─► Brain Worker (種B) ─┤ sense ▼ / ▲ action    │
│                       ─► Brain Worker (種…) ─┘                       │
│                                 │                                   │
│                          ┌──────┴───────────┐                       │
│                          │  engine (純粋)    │  決定論的・seeded RNG │
│                          │  world / tick     │  three/DOM 非依存     │
│                          └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

**役割分担**

- **engine/**: 純粋・決定論的なシミュレーション。DOM/React/Worker に非依存（`tsconfig.engine.json` で
  `lib` を絞り、`window`/`Math.random`/`Date` の使用を禁ずる）。Vitest で単体テスト可能。
- **sandbox/**: ユーザコードのコンパイルと Worker のライフサイクル管理。sense/action プロトコル、
  タイムアウト、再生成（respawn）を担う。
- **render/ + ui/**: React。エンジンの snapshot を rAF で**補間描画**（ティックは粗くても滑らかに見せる）。

**実行モデル（`elecxzy` との重要な差分）**

- Worker は **種ごとに1つ・常駐**（elecxzy は単発実行）。個体は `Memory` をティック跨ぎで保持するため。
- 毎ティック：エンジンが当該種の全生存個体ぶんの `sense` を一括送信 → Worker が各個体の `think()` を
  順に実行し `action[]` を返す → エンジンが権威的に解決。
- **個体の本体状態（位置・エネルギー・年齢など）はエンジンが保持**。Worker が持つのはユーザの `Memory` のみ。
  → Worker を `terminate()` しても失うのは一時メモリだけで、世界は壊れない。

### 3.1 ティックのデータフロー

```
engine.buildSenses(world)         // 種ごとに { creatureId, sense }[] を生成
   → brainHost.tick(speciesId, senses, seed, budgetMs)
       → worker.postMessage({type:'tick', senses, seed})
       ← worker.postMessage({type:'actions', actions})   // budgetMs 以内
   → engine.resolve(world, allActions, tickSeed)          // 権威的解決
   → engine.advance(world)                                // 代謝/加齢/植物成長/死亡処理
   → store.setSnapshot(world.snapshot())                  // 描画へ
```

---

## 4. サンドボックスとセキュリティ

`elecxzy` の二段構えを踏襲する。**真の防壁は CSP**、Worker プロローグの globals 無効化は多層防御。

### 4.1 コンパイル（main thread）

```ts
import { transform } from 'sucrase';
const { code } = transform(userSource, {
  transforms: ['typescript', 'imports'],   // 型除去 + ESM→CommonJS
  filePath: `${speciesName}.ts`,
});
```

- 出力は CommonJS（クラシック Worker で動かすため。ESM ネスト import は CSP で弾かれる）。
- コンパイルエラーは行番号付きでエディタに inline 表示し、その種はエントリ不可。

### 4.2 Worker のハードニング（prologue）

```js
// WORKER_PROLOGUE（compiledJS の前に連結）
self.fetch=undefined; self.XMLHttpRequest=undefined; self.WebSocket=undefined;
self.importScripts=undefined; self.Worker=undefined; self.SharedWorker=undefined;
self.indexedDB=undefined; self.caches=undefined; self.EventSource=undefined;
self.BroadcastChannel=undefined; self.RTCPeerConnection=undefined;
self.navigator=undefined; self.location=undefined;
// 決定論のため Date / 時刻系を凍結し、Math.random を seeded ストリームに差し替える
const __rng = makeSeededRng(0);
Math.random = () => __rng();           // engine が tick ごとに per-creature 再seed
Date.now = () => 0; performance.now = () => 0;
var module={exports:{}}; var exports=module.exports;
// '@elecxarium/creature' のみ許可（harness が runtime を注入）。他は全拒否
function require(n){ if (n === '@elecxarium/creature') return globalThis.__ELECX_API__;
  throw new Error('imports are not available: ' + n); }
```

- Blob URL から `new Worker(blobUrl)` で生成（`eval`/`new Function` は使わない）。
- **CSP（`index.html` の meta）**:
  ```
  default-src 'self'; script-src 'self' 'unsafe-inline';
  worker-src 'self' blob:; connect-src 'self';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:;
  ```
  - `unsafe-eval` 無し → `eval`/`new Function` 不能（無効化した globals を復元できない）。
  - `connect-src 'self'` → 外部通信不能。

### 4.3 メッセージプロトコル（main ↔ Brain Worker）

| 方向 | type | payload | 用途 |
|---|---|---|---|
| → | `init` | `{ compiledJs, apiRuntime }` | モジュール評価。`defineCreature` の戻りを保持。`meta`/`traits` を検証して返す |
| ← | `ready` | `{ meta, traits, traitErrors? }` | エントリ受理可否 |
| → | `tick` | `{ senses: {id, sense}[], seed }` | 当該種の全生存個体ぶん |
| ← | `actions` | `{ actions: {id, action}[] }` | budgetMs 以内に返す |
| ← | `error` | `{ id?, message }` | 個体単位の例外（種は継続） |

### 4.4 タイムアウトと耐障害

- 種ごとの per-tick 予算: `budgetMs = COMPUTE_BASE_MS + COMPUTE_PER_CREATURE_MS * liveCount`（上限 `COMPUTE_MAX_MS`）。
- 超過 → main 側で `worker.terminate()` → **即 respawn（`init` 再送）**。当該ティックは全個体 idle、strike +1。
- `STRIKES_MAX` 連続で strike → 種を **失格（DQ）**：全個体除去、リーダーボードに DQ 表示。
- 個体単位で `think()` が throw → その個体のみ idle・ログ記録。種は継続。
- `init` で throw / `traits` 超過 → エントリ不可（エディタにエラー）。

### 4.5 ワーカーランタイムと import 解決

CSP 下では `eval`/`new Function` が使えないため、ユーザコードは **Blob URL の Worker ソースに連結**して実行する（elecxzy と同方式）。
このとき `import { defineCreature } from '@elecxarium/creature'` は sucrase により `require('@elecxarium/creature')` へ変換される。

- ビルド時に **creature-api ランタイム＋ハーネス（prologue/メッセージループ）を依存ゼロの IIFE 文字列**として用意し、
  `globalThis.__ELECX_API__`（`defineCreature` とヘルパ群）と tick ディスパッチを公開する。
- Worker ソース = `harnessString + "\n" + compiledUserCode`。`require` は §4.2 のとおり当該 specifier のみ許可。
- ハーネス文字列は Vite の `?raw` 取り込み＋事前バンドル（または専用エントリの IIFE 出力）で生成し、本体バンドルに文字列として同梱。
  これにより「ユーザの import が解決でき、かつ eval 不要」を両立する。

---

## 5. Creature API（公開コントラクト）

ユーザが `import` して書く対象。型定義 `creature-api/api.d.ts` を Monaco に流し込み**補完を効かせる**。

### 5.1 定義エントリ

```ts
import {
  defineCreature, moveToward, attack, eat, reproduce, defend, idle,
  dist, nearest, type Sense, type Action, type Memory,
} from '@elecxarium/creature';

export default defineCreature({
  meta: { name: 'GreyWolf', author: 'shinsaku', role: 'carnivore' },

  // 持ち点配分。合計 <= TRAIT_BUDGET(=100)。超過はエントリ不可
  traits: {
    maxEnergy: 15, eyesight: 25, speed: 25,
    attack: 25, defense: 5, eatingSpeed: 5, camouflage: 0,
  },

  // コマの見た目（省略時はロール別デフォルトスキン）。currentColor が種カラーに置換される
  appearance: { viewBox: '0 0 32 32', svg: `<path d="M4 20 16 6 28 20Z" fill="currentColor"/>` },

  // 任意: 個体の初期メモリ
  initMemory: (): Memory => ({ patrolTarget: null }),

  // 1ティックに各個体1回呼ばれる純粋関数。副作用は mem への書き込みのみ
  think(sense: Sense, mem: Memory): Action {
    if (sense.events.some(e => e.type === 'attacked')) return defend();
    const prey = nearest(sense.nearby, o => o.role === 'herbivore' && o.isAlive);
    if (!prey) return moveToward(mem.patrolTarget ?? sense.world.center);
    return prey.distance <= sense.self.reach ? attack(prey.id) : moveToward(prey.position);
  },
});
```

### 5.2 型

```ts
type Role = 'herbivore' | 'carnivore' | 'plant';   // plant = プログラマブル植物（静止・光合成・繁殖のみ）
type Vec2 = { x: number; y: number };

interface Traits {                         // 各 0..TRAIT_BUDGET の整数, 合計 <= TRAIT_BUDGET
  maxEnergy: number; eyesight: number; speed: number;
  attack: number; defense: number; eatingSpeed: number; camouflage: number;
}

interface OrganismView {                   // 視界内に見える他個体/植物/死骸（読み取り専用）
  id: string;
  kind: 'animal' | 'plant' | 'carcass';
  role?: Role;                             // animal のみ
  species: string;                         // 種名（自種判定に使える）
  isOwn: boolean;                          // 自分と同じ種か
  position: Vec2;
  distance: number;                        // 自分からの距離
  energyState: 'high' | 'medium' | 'low';  // 正確な数値は秘匿（段階のみ）
  isAlive: boolean;
}

interface Sense {
  tick: number;
  self: {
    id: string; position: Vec2;
    energy: number; energyMax: number;     // 自分の数値は分かる
    age: number; lifespan: number;
    reach: number;                         // 攻撃/捕食できる距離(=INTERACT_RANGE)
    moveMax: number;                       // 1ティックの最大移動距離
    sightRadius: number;
    canReproduce: boolean;                 // クールダウン/エネルギー要件を満たすか
  };
  world: { width: number; height: number; center: Vec2 };
  nearby: OrganismView[];                   // 視界内のみ。相手の camouflage で減る
  events: GameEvent[];                      // 前ティック以降に自分に起きた事
  random: () => number;                     // 決定論的 RNG [0,1)
}

type GameEvent =
  | { type: 'attacked'; byId: string; damage: number }
  | { type: 'ateOk'; targetId: string; gained: number }
  | { type: 'eatFailed'; reason: 'tooFar' | 'notFood' | 'full' | 'gone' }
  | { type: 'born' }
  | { type: 'reproduced'; childId: string };

type Action =
  | { kind: 'move'; to: Vec2 }
  | { kind: 'attack'; targetId: string }
  | { kind: 'eat'; targetId: string }
  | { kind: 'reproduce' }
  | { kind: 'defend' }
  | { kind: 'idle' };

interface CreatureDef {
  meta: { name: string; author?: string; role: Role };
  traits: Traits;
  appearance?: { viewBox: string; svg: string };
  initMemory?: () => Memory;
  think: (sense: Sense, mem: Memory) => Action;
}
type Memory = Record<string, unknown>;
```

### 5.3 ヘルパ（`@elecxarium/creature` が提供）

| 関数 | 役割 |
|---|---|
| `move(to)` / `moveToward(pos, maxDist?)` | 移動アクション（`moveMax` で自動クランプ） |
| `attack(id)` / `eat(id)` / `reproduce()` / `defend()` / `idle()` | 各アクションを返す |
| `dist(a, b)` | 2点間距離 |
| `nearest(list, pred?)` / `farthest(...)` | 述語に合う最近/最遠を返す |
| `clampToWorld(pos, world)` | 範囲内に収める |

> アクションは「宣言」を返すだけで、実際の解決はエンジンが行う（無効・到達不能なら no-op + イベント通知）。

---

## 6. シミュレーション規則

### 6.1 世界と初期化

- 有界2D連続平面 `WORLD_W × WORLD_H`（壁で反射せず、移動はクランプ）。
- 各エントリ種を `INITIAL_POP` 個体、**世界全体に一様散布**してスポーン（seeded）。捕食者と被食者が最初から混在して相互作用する（クラスタ配置だと捕食者が遠すぎる獲物を視認できず餓死し、生態系が成立しないため）。
- 植物（環境リソース）を `PLANT_TARGET` 個まで自動スポーンし、減ったら徐々に再生。
- 近傍探索は **uniform grid 空間インデックス**（セル一辺 ≈ 最大視界）を毎ティック再構築し、視界/相互作用判定を O(N) 近傍に抑える。

### 6.2 ティックの解決順序（決定論）

1. **Sense 構築** → 種ごとに Worker へ送信し `action[]` 回収（タイムアウト管理）。
2. **行動の権威的解決**（公平性のため、各個体を tickSeed 由来の順序でシャッフルして処理）:
   1. `defend` / `idle` フラグ適用
   2. `move` 適用（`moveMax` クランプ → 新位置 → 壁クランプ → 重なり解消）
   3. `attack` 解決（`reach` 内か判定 → ダメージ → エネルギー0で死亡＝死骸化）
   4. `eat` 解決（草食=植物 / 肉食=死骸、`reach` 内、`eatingSpeed` 分転送）
   5. `reproduce` 解決（要件充足で同種の子を隣接スポーン）
3. **環境更新**: 代謝でエネルギー減、加齢、植物成長/再生、死骸の腐敗。
4. **掃除**: エネルギー≤0 / 寿命超過 → 死亡（動物は死骸化、死骸は腐敗で消滅）。
5. `tick++`、snapshot 発行。

### 6.3 特性 → 能力のマッピング（既定式・すべて `CONFIG` で調整可）

| 能力 | 式（trait は 0..100） |
|---|---|
| 視界半径 `sightRadius` | `40 + eyesight * 2.6` |
| 1ティック最大移動 `moveMax` | `4 + speed * 0.16` |
| エネルギー上限 `energyMax` | `60 + maxEnergy * 1.4` |
| 攻撃ダメージ | `4 + attack * 0.5` |
| 防御減算 | `defense * 0.25`（一定軽減）。`defend` 中はさらに最終ダメージを半減 |
| 1ティック捕食量 | `4 + eatingSpeed * 0.26` |
| 被発見半径係数 | 観測者の `sightRadius * (1 - camouflage/100 * 0.7)` 内でのみ視認される |

### 6.4 エネルギー経済

- **代謝**（毎ティック消費）: `metabolismBase + moveCost`
  - `metabolismBase = 0.5 + energyMax * 0.004`（大型ほど燃費が悪い）
  - `moveCost = distanceMoved * 0.12`
- **捕食**: `gained = min(eatRate, target.energy, energyMax - energy)`。対象はその分減る。
- **攻撃**: `dmg = max(0, attackDamage - targetDefense)`。対象 `energy -= dmg`。0 で死亡。
- **死骸**: 残存エネルギー = `victim.energyMax * 0.6`。`DECAY_TICKS` で消滅。肉食のみ捕食可。
- **植物**: 毎ティック `PLANT_GROWTH` 成長（上限 `PLANT_MAX`）。草食が食べると減る。

### 6.5 繁殖・加齢・死亡

- **繁殖**: `energy >= energyMax * REPRO_THRESHOLD(0.6)` かつ クールダウン明け で可。
  - コスト = `energyMax * REPRO_COST(0.5)`。子の初期エネルギー = コスト × `(1 - REPRO_TAX(0.1))`。
  - 子は同種・同 traits、隣接位置にスポーン。クールダウン `REPRO_COOLDOWN` ティック。
- **加齢**: `age` がティックごとに増加。`age > lifespan` で寿命death（死骸化）。
  - `lifespan = LIFESPAN_BASE ± jitter(seeded)`。
- **死亡**: `energy <= 0` または 寿命 → 死亡。動物は死骸を残す。

### 6.6 スコアと勝敗

- マッチ長: `MATCH_TICKS`（既定 3000）。または「最後の1種」まで／無限サンドボックス。
- ライブ指標（種ごと）: 現在個体数 / 総バイオマス(Σenergy) / 累計出生 / 累計死亡 / ピーク個体数 / kills。
- **最終スコア（既定の合成指標）**:
  1. 生存（マッチ終了時に生存個体 > 0）
  2. **時間積分個体数** `Σ_tick population`（瞬間的なスパイクでなく持続的優勢を評価＝Terrarium的）
  3. 総バイオマス（同点時のタイブレーク）
  - すべて `CONFIG.scoring` で重み変更可能。

---

## 7. 決定論とリプレイ

- **完全決定論**: マスターシード → seeded PRNG（`mulberry32` 等）。エンジンは派生シードを各サブシステムへ。
- 各個体には `sense.random()` として **per-(creature, tick) 再シード**したストリームを提供。
  Worker 内の `Math.random` も同ストリームに差し替えるため、ユーザが `Math.random` を呼んでも決定論を保つ。
- `Date.now`/`performance.now` は 0 固定。エンジン自身も実時刻・`Math.random` を使わない。
- **リプレイ** = `{ seed, config, species: [{ name, sourceHash, source }] }`。同入力なら完全再現。
  - 加えて per-tick の `action log` も記録可能（Worker を再実行せずスクラブ／検証できる）。
- **注意（超越関数）**: `Math.sin/cos/pow/exp/log` 等は JS エンジン間でビット一致が保証されない。
  同一エンジンのリプレイは完全一致するが、クロスマシン厳密一致のため engine 側は四則と `sqrt`（IEEE754 で決定的）中心に実装し、
  必要時のみ決定論的近似ヘルパを提供する。

---

## 8. レンダリング

- **SVG アリーナ**: world 座標 → viewBox にスケール。各個体 = `<g transform>` に `appearance.svg`
  （無ければロール別デフォルトスキン）。`currentColor` を種カラーに置換。
- **エネルギーリング**: 個体外周に弧（`steel-ignition` の rpm リング応用）。残エネルギー比を表示。
- **補間**: シミュは固定レート（既定 10 tick/s, 1〜30 可変）、描画は rAF で prev→next snapshot を lerp。
- **エフェクト**: 攻撃フラッシュ／捕食パルス／出生ポップ／死亡フェード。カモフラージュ個体は淡く描画。
- **デフォルトスキン**: 草食＝丸み、肉食＝鋭角、植物＝葉/星型。種カラーで識別。
- **性能**: 〜1–2k ノードまで SVG で快適。それを超えるなら canvas フォールバックを検討（注記）。

---

## 9. UI/UX

**レイアウト（デスクトップ優先）**

```
┌──────────────┬───────────────────────────┬──────────────┐
│ Editors(tabs)│        SVG Arena           │ Leaderboard  │
│ Monaco×種    │   (tick / speed overlay)   │ (種別ライブ) │
│ [Load/Reload]│                            │ Controls     │
│  compile err │                            │ Start/Pause  │
│  inline      │                            │ Step/Reset   │
│              │                            │ speed/seed   │
├──────────────┴───────────────────────────┴──────────────┤
│ Log Console (種別 runtime error / events)  |  Timeline ▷ │
└────────────────────────────────────────────────────────┘
```

- **レイアウト基盤**: `react-resizable-panels` でエディタ/アリーナ/サイドの3ペインをユーザがリサイズ可能。
- **エディタ**: タブ＝種。Monaco に `creature-api` の `.d.ts` を注入し補完・型診断。`Load/Reload` で
  sucrase コンパイル → 成功でエントリ、失敗は inline エラー。サンプル creature をドロップダウンで挿入。
- **コンポーネント基盤**: アクセシブルなプリミティブは **Radix UI**（Tabs/Slider/Tooltip/Dialog/DropdownMenu）、
  アイコンは **lucide-react**、アニメーションは **motion（framer-motion）**。`clsx`+`tailwind-merge` でクラス合成。
- **コントロール**: Start / Pause / Step / Reset、速度スライダ、seed 入力、マッチ長設定。
- **リーダーボード**: 種カラー・名前・個体数・バイオマス・kills をライブ更新。
- **ログ**: 種別の runtime 例外、主要イベントのフィード。
- **タイムライン**: リプレイのスクラブ。
- **デザインシステム**: **Tailwind v4（CSS-first `@theme`）**＋ **OKLCH** カラートークン。ダーク基調＋グラスモーフィズム＋
  種ごとのネオンアクセント。UI フォント Inter、コードは JetBrains Mono。
- **アクセシビリティ/モーション**: キーボード操作・可視フォーカスリング・ARIA、`prefers-reduced-motion` を尊重して減衰。
- **堅牢性**: React error boundary でパネル単位の障害を隔離（1種のクラッシュが全体を落とさない）。

---

## 10. プロジェクト構成

```
elecxarium/
  index.html                 # CSP meta（unsafe-eval無し / connect-src 'self'）
  vite.config.ts             # base:'./', worker:{format:'es'}
  tailwind.config.ts
  tsconfig.json
  tsconfig.engine.json       # engine の純粋性を強制（DOM/Date/Math.random 禁止）
  electron/main.cjs
  .github/workflows/deploy.yml
  docs/SPEC.md               # 本書
  src/
    main.tsx
    engine/                  # 純粋・決定論シミュ（three/DOM 非依存）
      types.ts world.ts rng.ts traits.ts scoring.ts replay.ts tick.ts
      rules/{movement,combat,eating,reproduction,metabolism,plants}.ts
    sandbox/
      compile.ts             # sucrase ラッパ
      brainHost.ts           # Worker ライフサイクル / プロトコル / timeout / respawn
      workerPrologue.ts      # ハードニング + seeded Math.random + メッセージループ
      brainWorker.ts         # Worker エントリ（ユーザモジュール評価 + tick ディスパッチ）
    creature-api/
      index.ts               # defineCreature + ヘルパ
      types.ts               # Sense / Action / Traits / OrganismView / CreatureDef
      api.d.ts               # Monaco 注入用（ビルド時に生成 or 同梱）
    render/
      Arena.tsx pieces.tsx skins.tsx interpolate.ts
    ui/
      App.tsx EditorPanel.tsx Leaderboard.tsx Controls.tsx LogConsole.tsx Timeline.tsx
      monacoSetup.ts
    state/                   # zustand ストア
    styles/ theme.css
    templates/               # スターター creature（herbivore.ts / carnivore.ts）
  test/                      # Vitest（engine 中心）
```

---

## 11. 技術スタック

| 領域 | 採用 | 備考 |
|---|---|---|
| ビルド/Dev | **Vite 8** | `base:'./'`, `worker:{format:'es'}` |
| 言語 | **TypeScript（strict）** | engine は別 tsconfig で純粋性強制 |
| UI | **React 19 + Tailwind** | `elecxzy` と同系統 |
| エディタ | **Monaco**（`@monaco-editor/react`） | TS 補完 + 型診断 + `.d.ts` 注入 |
| ユーザコード変換 | **sucrase** | `transforms: ['typescript','imports']` |
| 状態管理 | **zustand**（軽量） | UI ↔ engine の橋渡し |
| デスクトップ | **Electron 42 + electron-builder** | `steel-ignition` 流 |
| テスト | **Vitest** | engine の決定論を回帰テスト |
| UI プリミティブ | **Radix UI** | アクセシブルな Tabs/Slider/Tooltip/Dialog |
| アニメーション | **motion**（framer-motion） | 補間・トランジション、reduced-motion 対応 |
| アイコン/レイアウト | **lucide-react** / **react-resizable-panels** | アイコン・リサイズ可能ペイン |
| クラス合成 | **clsx** / **tailwind-merge** | 条件付き className の安全な合成 |
| 品質 | **ESLint(flat)** / **Prettier** / **EditorConfig** | Lint・整形・エディタ統一。CI で typecheck+test+build |

> ID 生成は決定論のため `nanoid` 等を使わず、engine の seeded カウンタで採番する。

---

## 12. ビルドとデプロイ

```jsonc
// package.json scripts（方針）
{
  "dev":        "vite",
  "build:web":  "tsc --noEmit && vite build",          // 静的サイト（dist のみ）
  "app:build":  "tsc --noEmit && vite build && electron-builder",
  "electron:dev":"concurrently -k vite \"wait-on http://localhost:5180 && electron . --dev-server-port=5180\"",
  "test":       "vitest"
}
```

- **静的配信**: `build:web` → `dist/` を **Cloudflare Pages（手動 `workflow_dispatch`）** で配信。
  `base:'./'` により相対パスで GitHub Pages 等にも載る。
- **Electron**: `app.isPackaged` で dev(URL) / prod(`loadFile`) 切替。固定ポート＋`--strictPort`＋`wait-on`。
- **CSP**: `index.html` の meta で全環境共通に適用（§4.2）。

---

## 13. チューニング定数（デフォルト）

`engine/config.ts` に集約。バランス調整・テストはここを起点にする。

```ts
export const CONFIG = {
  world:   { WORLD_W: 1200, WORLD_H: 1200, INTERACT_RANGE: 8 }, // 広い世界＋多個体数で相互作用を確保（v0.3）
  match:   { MATCH_TICKS: 3000, TICKS_PER_SEC: 10, INITIAL_POP: 36 },
  traits:  { TRAIT_BUDGET: 100 },
  energy:  { METAB_BASE_K: 0.003, METAB_FLOOR: 0.35, MOVE_COST_K: 0.06 }, // 移動は安価め（捕食者が狩れる）
  combat:  { ATTACK_COOLDOWN: 2, DEFEND_REDUCTION: 0.5 },   // defend() は被弾を半減
  repro:   { REPRO_THRESHOLD: 0.6, REPRO_COST: 0.5, REPRO_TAX: 0.1, REPRO_COOLDOWN: 20 },
  life:    { LIFESPAN_BASE: 1500, LIFESPAN_JITTER: 300 },
  carcass: { RESIDUAL: 0.92, DECAY_TICKS: 80 },
  // 植物の自己制限は本家Terrarium流の3機構:
  //  (1) 光合成 photo0 = PHOTO_BASE + eatingSpeed*PHOTO_PER_POINT、局所シェーディング(純収支):
  //      photo = max(UPKEEP+SURPLUS_FLOOR, photo0*(1-CROWD_K*n))、n = 半径 CROWD_RADIUS 内の他植物数。
  //  (2) 種子散布＋空間排他: 子は親から距離[SEED_SPACING, +SEED_SPREAD]のランダム方向へ置かれ、同種植物が
  //      SEED_SPACING 内に居ない(=空き地)ときだけ発芽(SEED_ATTEMPTS 回試行)。→植物は空き地へコロニー化し、
  //      重なれず、空間的に頭打ち。SPECIES_CAP は最終保険。
  //  (3) TARGET_WITH_PLAYER: 植物プレイヤーが居る対戦では自然発生植物を止める(=0)。本家に自然発生植物は無く
  //      植物"生物"が唯一の生産者。植物不在の対戦(例 Grazer vs Stalker)のみ PLANT_TARGET の自然発生餌を維持。
  plants:  { PLANT_TARGET: 155, TARGET_WITH_PLAYER: 0, PLANT_GROWTH: 0.9, PLANT_MAX: 80,
             RESPAWN_EVERY: 6, RESPAWN_BATCH: 14, PHOTO_BASE: 0.4, PHOTO_PER_POINT: 0.05, UPKEEP: 0.12,
             CROWD_RADIUS: 50, CROWD_K: 0.45, SURPLUS_FLOOR: 0, SPECIES_CAP: 150,
             SEED_SPACING: 60, SEED_SPREAD: 100, SEED_ATTEMPTS: 5 },
  // バランスは scripts/sim.ts で計測。既定ロスターは3種(Bloom/Grazer/Stalker)。活力ある植物(高PHOTO)＋種子散布で
  //   植物が世界をコロニー化→草食を支え→肉食に十分な獲物。8シード2000tで3種すべて生存8/8・both-extinct 0・
  //   肉食 avgKills≈149/seed・avgFinal≈20 の頑健な共存(30シード3000tでも肉食生存 25/30)。慎重繁殖ゲート0.9も維持。
  // 重要な発見: 存続する強い肉食は「大量の獲物(~150-200草食)」を要し、それには~150植物→合計~400個体が必要。
  //   エンジンは余裕(ヘッドレス~600tick/s)だが SVG 描画が律速だったため、生物描画を Canvas に移行
  //   (src/render/Arena.tsx: 生物はスプライトで Canvas 描画、背景と一時エフェクトのみ薄い SVG 層)→~400個体で~37tick/s。
  // 鍵: 草食は「実入りのある(energyState!=='low')植物」を採り、枯れたら移動(camping回避)。
  // 初期エネルギー = energyMax*0.7、全種を世界全体に一様散布。
  compute: { COMPUTE_BASE_MS: 6, COMPUTE_PER_CREATURE_MS: 1.5, COMPUTE_MAX_MS: 120, STRIKES_MAX: 3 },
  // score = 生存×W_SURVIVAL + popIntegral + biomass×W_BIOMASS。ただし UI リーダーボードは本家Terrarium同様
  // 栄養段階別に順位付け(scoring.ts の rankInRole)—肉食は肉食同士で競い、植物と個体数を直接比較しない。
  // この weight は全体順位＋「どの種が最も繁栄したか」の生態系メトリクス(sim / balance テスト)用。
  scoring: { W_SURVIVAL: 1e9, W_POP_INTEGRAL: 1, W_BIOMASS: 1e-3 },
} as const;
```

---

## 14. マイルストーン

| M | 内容 | 完了条件 |
|---|---|---|
| **M0** | 足場: Vite+React+TS+Tailwind+Electron, CSP, deploy ワークフロー | 空アリーナが dev/Electron/静的で起動 |
| **M1** | engine コア（ヘッドレス・純粋）: 型/world/決定論 tick/移動/代謝/死亡/植物 | ハードコード脳で Vitest が緑、リプレイ一致 |
| **M2** | sandbox: sucrase + Brain Worker + プロトコル + timeout/respawn | 1種をユーザコードで動かせる |
| **M3** | 全規則: 戦闘/捕食/繁殖/加齢/スコア/多種同時 | 複数種のエコシステムが成立 |
| **M4** | レンダリング: SVG アリーナ/補間/スキン/エネルギーリング/エフェクト | 滑らかに観戦できる |
| **M5** | UI: Monaco（型補完）/リーダーボード/コントロール/ログ/テンプレート | 貼付→Load→対戦の一連が完結 |
| **M6** | リプレイ＋仕上げ: seed/replay/タイムライン/テーマ磨き/サンプル creature | 共有可能なマッチ、整った見た目 |
| **M7（stretch）** | ユーザ植物種 / トーナメント / P2P "EcoSystem" モード / 共有リンク | — |

---

## 15. 将来拡張・未決事項

> **実装状況 (M0–M7 完了):** engine（純粋・決定論）／サンドボックス（sucrase + Blob Worker + CSP）／全シミュ規則／
> SVG 描画＋補間／UI（React + Tailwind + Monaco）／リプレイ＆共有リンク／総当たりトーナメント を実装。
> 各層の単体テスト＋全層を貫く統合テスト（計 96 テスト）、typecheck/lint/build green、ブラウザ実機で
> Blob Worker 実行と CSP を確認済み。以下は今後の拡張。

- **P2P エコシステム**（オリジナルの EcoSystem モード / 青いテレポーターボール）: v1 はローカル単一世界。
  将来 WebRTC or サーバ relay で種を機械間移動させる。
- **✅ プログラマブル植物 (`role: 'plant'`)**: 実装済み。静止・光合成（収入は `eatingSpeed` に比例）・`reproduce` で散布。
  草食は `kind:'plant'` として捕食でき、植物は死骸を残さない。背景の自動植物も従来どおり食料として併存。
  テンプレは Bloom(smart=過密回避)/Moss(simple=素朴に拡散) の2種。素朴な植物が世界を埋めないよう種ごとに個体数上限 `speciesCap`(150)。
- **アンテナ／シグナリング**（Terrarium の Antennas）: 個体間で数値シグナルを発信・受信し群れ・協調行動を可能にする。
  案: `think` の戻りに `signal?: number` を追加し `OrganismView.signal?` で受信。**Terrarium 忠実度向上の最優先候補**（次段で実装予定）。
- **子への遺伝情報 (DNA)**: `reproduce` に `childMemory?` を載せ子の初期メモリへ継承し、学習・進化戦略を可能にする（次段）。
- **公平性修正 (v0.3, API レビュー反映)**: 失格フラグをスコアへ伝播（タイムアウト種が無罰だったバグを修正）。
  未発火だった `collided` イベントを公開 API から削除。CUI シミュレーションを完全同期実行（sleep/await なし）化。
- **API バージョニング**: `meta.apiVersion` で前方互換。
- **膠着対策**: 長時間決着しない場合の縮小する世界・資源枯渇など。
- **不正・悪用対策の追加検証**: メモリ肥大（Worker メモリ上限）、巨大アクション、過剰ログのレート制限。
- **観戦性**: ヒートマップ、系統樹、種ごとの統計グラフ。

---

## 16. 付録: オリジナル Terrarium との対応表

| Terrarium (.NET) | elecxarium (本実装) |
|---|---|
| `class X : Animal` ＋ `Initialize` でイベント登録 | `defineCreature({ meta, traits, think })` |
| イベント `Idle/Attacked/Collided/...` | `sense.events[]` ＋ 毎ティック `think()` |
| `Scan()` → `OrganismState[]` | `sense.nearby: OrganismView[]` |
| `BeginMoving(MovementVector)` | `move(to)` / `moveToward(pos)` |
| `BeginAttacking/Eating/Defending/Reproduction` | `attack/eat/defend/reproduce` |
| 持ち点属性 `[...Points]` | `traits`（合計 ≤ `TRAIT_BUDGET`） |
| `[AnimalSkin]` 等の見た目 | `appearance.svg`（SVG in TS） |
| 1個体 2–5ms の時間制限 | per-tick 予算 + `terminate()`/respawn |
| .NET CAS サンドボックス | Web Worker + CSP |
| EcoSystem（P2P 移動） | 将来拡張（M7） |

---

*出典（Terrarium 調査）:* [Microsoft News 2002](https://news.microsoft.com/source/2002/02/25/microsoft-terrarium-game-demonstrates-continuing-developer-enthusiasm-for-net-platform/) ・ [terrariumapp.github.io](http://terrariumapp.github.io/) ・ [terrarium-sdk (GitHub)](https://github.com/terrariumapp/terrarium-sdk) ・ [Animal.CanEat SDK docs](https://terrariumapp.github.io/terrarium-sdk/docs/html/933f94b4-f32f-ef63-322d-12c2edd26414.htm) ・ [Scott Hanselman's blog](https://www.hanselman.com/blog/learning-opportunity-net-terrarium-is-back)
