import fs from "node:fs";
import path from "node:path";

// ============================================================================
// DeepSeek V3 BPE Tokenizer (纯 JS 实现)
// ============================================================================
// 从官方 tokenizer.json 加载 vocab + merges，精确计算 token 数
// 原理：Llama 风格 byte-level BPE，与 API 返回的 usage 一致
// ============================================================================

// GPT-2 byte-level 编码表：将每个 byte 映射为 unicode 字符
const BYTE_TO_UNICODE = (() => {
  const bs: number[] = [];
  // 可直接映射的 ASCII 范围
  const ranges = [
    [33, 127],   // '!' ~ '~' (排除空格)
    [161, 173],  // ¡ ~ ­
    [174, 256],  // ® ~ ÿ
  ];
  for (const [lo, hi] of ranges) {
    for (let i = lo; i < hi; i++) bs.push(i);
  }
  // 剩余 byte 映射到 U+0100 开始的 unicode
  const map = new Map<number, string>();
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (bs.includes(b)) {
      map.set(b, String.fromCodePoint(b));
    } else {
      map.set(b, String.fromCodePoint(256 + n));
      n++;
    }
  }
  return map;
})();

// GPT-2 预分词正则（与 DeepSeek V3 一致）
const PRE_TOKENIZE_RE =
  /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

interface BPEState {
  vocab: Map<string, number>;
  merges: Map<string, number>; // "token1 token2" → merge rank
  loaded: boolean;
}

const state: BPEState = {
  vocab: new Map(),
  merges: new Map(),
  loaded: false,
};

let loadPromise: Promise<void> | null = null;

function ensureLoaded(): Promise<void> {
  if (state.loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // tsx 运行时 __dirname 是 src/ 目录；编译后 __dirname 也是 src/ 目录
    const tokenizerPath = path.join(__dirname, "tokenizers", "tokenizer.json");
    const raw = fs.readFileSync(tokenizerPath, "utf-8");
    const config = JSON.parse(raw);

    // 加载 vocab
    for (const [token, id] of Object.entries(config.model.vocab as Record<string, number>)) {
      state.vocab.set(token, id);
    }

    // 加载 merges（rank = 数组索引，越小优先级越高）
    const merges = config.model.merges as string[];
    for (let i = 0; i < merges.length; i++) {
      state.merges.set(merges[i], i);
    }

    state.loaded = true;
  })();

  return loadPromise;
}

/**
 * 对一个词（已转为 byte-level unicode 字符序列）应用 BPE merges
 */
function applyBPE(word: string[]): string[] {
  if (word.length <= 1) return word;

  let tokens = [...word];

  while (true) {
    // 找到优先级最高（rank 最小）的 merge pair
    let bestPair = "";
    let bestRank = Infinity;

    for (let i = 0; i < tokens.length - 1; i++) {
      const pair = `${tokens[i]} ${tokens[i + 1]}`;
      const rank = state.merges.get(pair);
      if (rank !== undefined && rank < bestRank) {
        bestRank = rank;
        bestPair = pair;
      }
    }

    if (bestRank === Infinity) break; // 没有可 merge 的 pair

    // 执行 merge
    const [left, right] = bestPair.split(" ");
    const merged = left + right;
    const newTokens: string[] = [];
    let i = 0;

    while (i < tokens.length) {
      if (i < tokens.length - 1 && tokens[i] === left && tokens[i + 1] === right) {
        newTokens.push(merged);
        i += 2;
      } else {
        newTokens.push(tokens[i]);
        i++;
      }
    }

    tokens = newTokens;
  }

  return tokens;
}

/**
 * 将文本转为 byte-level 表示（每个 byte 映射为 unicode 字符）
 */
function textToByteLevel(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let result = "";
  for (const b of bytes) {
    result += BYTE_TO_UNICODE.get(b)!;
  }
  return result;
}

/**
 * 使用 DeepSeek V3 官方 tokenizer 精确计算 token 数
 */
export async function countTokens(text: string): Promise<number> {
  await ensureLoaded();

  // 1. 预分词
  const chunks = text.match(PRE_TOKENIZE_RE) || [text];

  let totalTokens = 0;

  for (const chunk of chunks) {
    // 2. 转 byte-level
    const byteLevel = textToByteLevel(chunk);

    // 3. 对每个字符单独应用 BPE（Llama 风格：每个字符作为初始 token）
    const chars = [...byteLevel];
    const tokens = applyBPE(chars);

    // 4. 统计 vocab 中存在的 token 数
    for (const token of tokens) {
      if (state.vocab.has(token)) {
        totalTokens++;
      } else {
        // 未知 token 拆分为单个字符，每个字符计一个 token
        totalTokens += token.length;
      }
    }
  }

  return totalTokens;
}

/**
 * 同步 fallback（仅在不支持 async 的场景下使用）
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
