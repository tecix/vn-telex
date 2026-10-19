// VN Telex for GNOME — Telex text -> Vietnamese.
// Engine ported from VN Textify by Loc Nguyen (MIT): https://www.raycast.com/locnguyen1842/vn-textify
// ES module for GNOME Shell (gjs).

const VOWELS = "aeiouyáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵâăêôơưấầẩẫậắằẳẵặếềểễệốồổỗộớờởỡợứừửữự";
const BASE_VOWEL_MAP = { â: "a", ă: "a", ê: "e", ô: "o", ơ: "o", ư: "u" };

const VALID_INITIALS_1 = new Set("bcdđghklmnprstvx".split(""));
const VALID_INITIALS_2 = new Set(["ch", "gh", "gi", "kh", "kr", "ng", "nh", "ph", "qu", "th", "tr"]);
const VALID_FINALS_1 = new Set(["c", "k", "m", "n", "p", "t", "i", "o", "u", "y"]);
const VALID_FINALS_2 = new Set(["ch", "ng", "nh"]);
const VALID_VOWEL_PAIRS = new Set([
  "ai", "ao", "au", "ay", "ei", "eo", "eu", "ia", "ie", "iu",
  "oa", "oe", "oi", "ua", "ue", "ui", "uo", "uy", "uu", "ye",
]);
// "ie"/"uo" only exist as iê/uô/ươ — plain "biet", "thuong" are not Vietnamese
const DIACRITIC_ONLY_PAIRS = new Set(["ei", "eu", "ye", "ue", "uu", "ie", "uo"]);

const TONE_MAP = [
  ["a", "á", "à", "ả", "ã", "ạ"],
  ["â", "ấ", "ầ", "ẩ", "ẫ", "ậ"],
  ["ă", "ắ", "ằ", "ẳ", "ẵ", "ặ"],
  ["e", "é", "è", "ẻ", "ẽ", "ẹ"],
  ["ê", "ế", "ề", "ể", "ễ", "ệ"],
  ["i", "í", "ì", "ỉ", "ĩ", "ị"],
  ["o", "ó", "ò", "ỏ", "õ", "ọ"],
  ["ô", "ố", "ồ", "ổ", "ỗ", "ộ"],
  ["ơ", "ớ", "ờ", "ở", "ỡ", "ợ"],
  ["u", "ú", "ù", "ủ", "ũ", "ụ"],
  ["ư", "ứ", "ừ", "ử", "ữ", "ự"],
  ["y", "ý", "ỳ", "ỷ", "ỹ", "ỵ"],
];

const TONE_TO_BASE = (() => {
  const m = new Map();
  for (const row of TONE_MAP) for (let i = 1; i < row.length; i++) m.set(row[i], row[0]);
  return m;
})();

const NORMALIZE_MAP = (() => {
  const m = new Map();
  for (const ch of VOWELS) {
    const noTone = TONE_TO_BASE.get(ch) || ch;
    m.set(ch, BASE_VOWEL_MAP[noTone] || noTone);
  }
  return m;
})();

const LETTER = /\p{L}/u;

function removeTone(ch) { return TONE_TO_BASE.get(ch) || ch; }
function normalizeToBaseVowel(ch) { return NORMALIZE_MAP.get(ch) || ch; }

function isValidVowelPair(chA, chB) {
  const baseA = normalizeToBaseVowel(chA);
  const baseB = normalizeToBaseVowel(chB);
  const base = baseA + baseB;
  const hasDiacritic = chA !== baseA || chB !== baseB;
  if (DIACRITIC_ONLY_PAIRS.has(base) && !hasDiacritic) return false;
  return VALID_VOWEL_PAIRS.has(base);
}

function isValidVietnameseWord(word) {
  const w = word.toLowerCase().split("").filter((ch) => LETTER.test(ch)).join("");
  const len = w.length;
  if (len === 0) return false;
  let i = 0;

  if (len > 3 && w.startsWith("ngh")) i = 3;
  else if (len > 2 && VALID_INITIALS_2.has(w.slice(0, 2))) i = 2;
  else if (VALID_INITIALS_1.has(w[0])) i = 1;

  let glideConsumed = false;
  if (i < len && w[i] === "o" && i + 1 < len && "ae".includes(removeTone(w[i + 1]))) {
    if (i === 0 || w[i - 1] !== "q") { i++; glideConsumed = true; }
  } else if (i < len && (w[i] === "u" || w[i] === "ư") && i + 1 < len && VOWELS.includes(w[i + 1])) {
    if (i === 0 || w[i - 1] !== "q") { i++; glideConsumed = true; }
  }

  if (i >= len || !VOWELS.includes(w[i])) return false;

  const vowelStart = i;
  while (i < len && VOWELS.includes(w[i])) i++;

  for (let j = vowelStart; j < i - 1; j++) {
    if (!isValidVowelPair(w[j], w[j + 1])) return false;
  }
  if (glideConsumed && !isValidVowelPair(w[vowelStart - 1], w[vowelStart])) return false;

  const rest = w.slice(i);
  if (rest.length === 0) return true;
  if (rest.length >= 2 && VALID_FINALS_2.has(rest.slice(0, 2))) return rest.length === 2;
  if (VALID_FINALS_1.has(rest[0])) return rest.length === 1;
  return false;
}

function getBestVowelIndex(word) {
  const allVowels = [];
  for (let i = 0; i < word.length; i++) {
    if (VOWELS.includes(word[i].toLowerCase())) allVowels.push(i);
  }
  const vowelsInWord = allVowels.length > 1
    ? allVowels.filter((idx) => {
        const ch = word[idx].toLowerCase();
        const prev = idx > 0 ? word[idx - 1].toLowerCase() : "";
        if (prev === "q" && ch === "u") return false;
        if (prev === "g" && ch === "i" && (idx === 1 || word[idx - 2].toLowerCase() !== "n")) return false;
        return true;
      })
    : allVowels;

  if (vowelsInWord.length === 0) return -1;
  if (vowelsInWord.length === 1) return vowelsInWord[0];

  const firstIdx = vowelsInWord[0];
  const secondIdx = vowelsInWord[1];
  const combined = word[firstIdx].toLowerCase() + word[secondIdx].toLowerCase();

  const toneOnSecond = ["oă", "uy", "uâ", "uô", "uơ", "uê", "iê", "ươ"];
  if ((combined === "oa" || combined === "oe") && secondIdx !== word.length - 1) return secondIdx;
  if (toneOnSecond.includes(combined)) {
    if (vowelsInWord.length >= 3 && combined === "uy") return vowelsInWord[2];
    return secondIdx;
  }
  if (vowelsInWord.length >= 3) return secondIdx;
  return firstIdx;
}

const TONES = { s: 1, f: 2, r: 3, x: 4, j: 5 };
const MODS = { a: { a: "â", w: "ă" }, e: { e: "ê" }, o: { o: "ô", w: "ơ" }, u: { w: "ư" }, d: { d: "đ" } };

function findModIdx(str, c) {
  // "dd" -> "đ" only on the initial d (like OpenKey): "didd" must not become "diđ"
  if (c === "d") return str.length > 0 && str[0].toLowerCase() === "d" ? 0 : -1;
  for (let i = str.length - 1; i >= 0; i--) {
    const v = str[i].toLowerCase();
    if (!MODS[v] || !MODS[v][c] || v === "d") continue;
    // "w" on "ua" -> prefer the "u" to form "ưa" (but not after "q")
    if (c === "w" && v === "a" && i > 0) {
      const prev = str[i - 1].toLowerCase();
      const notQu = i < 2 || str[i - 2].toLowerCase() !== "q";
      if (prev === "u" && notQu) return i - 1;
    }
    return i;
  }
  return -1;
}

function replaceChar(str, idx, replacement) {
  const orig = str[idx];
  const cased = orig === orig.toUpperCase() && orig !== orig.toLowerCase() ? replacement.toUpperCase() : replacement;
  return str.substring(0, idx) + cased + str.substring(idx + 1);
}

function hasVowel(str) {
  for (const ch of str) if (VOWELS.includes(ch.toLowerCase())) return true;
  return false;
}

// "ưo" -> "ươ" always; "uơ" -> "ươ" when something follows (người, trước, thương) —
// but keep "thuở", "huơ", "quơ"
function fixUoHorn(s) {
  for (let i = 0; i + 1 < s.length; i++) {
    const a = s[i].toLowerCase(), b = removeTone(s[i + 1].toLowerCase());
    const prev = i > 0 ? s[i - 1].toLowerCase() : "";
    if (a === "ư" && b === "o") {
      s = replaceChar(s, i + 1, "ơ" === removeTone(s[i + 1].toLowerCase()) ? s[i + 1] : "ơ");
    } else if (a === "u" && b === "ơ" && i + 2 < s.length && prev !== "q") {
      s = replaceChar(s, i, "ư");
    }
  }
  // "ươ" never ends a syllable: word-final ươ is really uơ (thuở, huơ)
  const n = s.length;
  if (n >= 2 && s[n - 2].toLowerCase() === "ư" && removeTone(s[n - 1].toLowerCase()) === "ơ") {
    s = replaceChar(s, n - 2, "u");
  }
  return s;
}

// Transform one run of letters, OpenKey-style:
// a tone key (s f r x j) anywhere after a vowel sets the tone; pressing it twice undoes it;
// z clears the tone; modifiers (aa ee oo aw ow uw dd) apply to the nearest matching vowel.
function transformWord(word) {
  let output = "";
  let tone = 0;
  let toneKey = "";

  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const c = ch.toLowerCase();

    if ((TONES[c] || c === "z") && hasVowel(output)) {
      if (c === "z") { if (tone) { tone = 0; continue; } }
      else if (c === toneKey && tone) { tone = 0; toneKey = ""; output += ch; continue; } // ss -> s
      else { tone = TONES[c]; toneKey = c; continue; }
    }

    const modIdx = findModIdx(output, c);
    if (modIdx === -1) { output += ch; continue; }

    const replacement = MODS[output[modIdx].toLowerCase()][c];
    output = replaceChar(output, modIdx, replacement);
    // "uo" + w -> "ươ"
    if (replacement === "ơ" && modIdx > 0 && output[modIdx - 1].toLowerCase() === "u") {
      output = replaceChar(output, modIdx - 1, "ư");
    }
  }

  output = fixUoHorn(output);
  if (!isValidVietnameseWord(output)) return word;

  if (tone > 0) {
    const idx = getBestVowelIndex(output);
    if (idx !== -1) {
      const base = removeTone(output[idx].toLowerCase());
      for (const row of TONE_MAP) {
        if (row[0] === base) { output = replaceChar(output, idx, row[tone]); break; }
      }
    }
  }
  return output;
}

// A token may mix letters and punctuation ("tanf,", "anh/chij"): transform each letter run
function transformToken(token) {
  return token
    .split(/(\P{L}+)/u)
    .map((part) => (part && LETTER.test(part[0]) ? transformWord(part) : part))
    .join("");
}

function telexTransform(input, skipWords) {
  const skips = (skipWords || []).map((w) => w.toLowerCase()).filter(Boolean);
  return input
    .split(/(\s+)/)
    .map((token) => {
      if (token === "" || /^\s+$/.test(token)) return token;
      const clean = token.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
      if (clean && skips.some((w) => clean.startsWith(w))) return token;
      return transformToken(token);
    })
    .join("");
}

function parseSkips(s) {
  return String(s || "").split(/[\s,;]+/).filter(Boolean);
}


export { telexTransform, parseSkips };
