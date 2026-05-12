/**
 * PNG Character Card Parser
 * 解析 Tavern 格式 PNG 元数据（tEXt / iTXt / zTXt chunks）
 * 
 * 兼容格式：
 *   - Tavern V1: character 字段
 *   - Tavern V2: chara 字段 (base64 编码的 JSON)
 *   - Chub/CharacterHub: ccv3 字段
 *   - 普通 JSON 角色卡
 */

// ============================================================
//  公开 API
// ============================================================

export async function parsePngCharacterCard(pngFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const metadata = await extractPngMetadata(arrayBuffer);
        console.log('[PNGParser] Raw metadata keys:', Object.keys(metadata));
        console.log('[PNGParser] chara exists:', !!metadata.chara);
        console.log('[PNGParser] ccv3 exists:', !!metadata.ccv3);
        console.log('[PNGParser] character exists:', !!metadata.character);
        const result = parseCharacterMetadata(metadata);
        resolve(result);
      } catch (error) {
        console.error('[PNGParser] Parse failed:', error);
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsArrayBuffer(pngFile);
  });
}

export function isSillyTavernCharacterCard(metadata) {
  return !!(metadata.chara || metadata.ccv3 || metadata.character || metadata.tavern);
}

export function getCharacterCardVersion(metadata) {
  if (metadata.ccv3) return 'v3';
  if (metadata.chara) return 'v2';
  if (metadata.character) return 'v1';
  return 'unknown';
}

// ============================================================
//  编码检测工具
// ============================================================

/**
 * 检测字节是否为有效的 UTF-8 编码
 * 使用 fatal: true 模式，无效 UTF-8 会抛出异常
 */
function isValidUtf8(bytes) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return !text.includes('\uFFFD');
  } catch (e) {
    return false;
  }
}

// ============================================================
//  PNG 二进制解析
// ============================================================

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

async function extractPngMetadata(arrayBuffer) {
  const view = new DataView(arrayBuffer);

  // 验证 PNG 签名
  for (let i = 0; i < 8; i++) {
    if (view.getUint8(i) !== PNG_SIGNATURE[i]) {
      throw new Error('不是有效的 PNG 文件');
    }
  }

  let offset = 8;
  const metadata = {};

  while (offset + 8 <= arrayBuffer.byteLength) {
    const length = view.getUint32(offset);
    offset += 4;

    const chunkType = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    offset += 4;

    console.log('[PNGParser] Found chunk:', chunkType, 'length:', length);

    if (chunkType === 'tEXt') {
      const data = extractTextChunk(view, offset, length);
      Object.assign(metadata, data);
    } else if (chunkType === 'iTXt') {
      const data = await extractITxtChunk(view, offset, length);
      Object.assign(metadata, data);
    } else if (chunkType === 'zTXt') {
      const data = await extractZTxtChunk(view, offset, length);
      Object.assign(metadata, data);
    }

    // 跳过数据 + CRC（4字节）
    offset += length + 4;

    if (chunkType === 'IEND') break;
  }

  return metadata;
}

// --- tEXt：文本，自动检测 UTF-8 / Latin-1 编码 ---
function extractTextChunk(view, offset, length) {
  const result = {};

  // 找 keyword 与 text 之间的 null 分隔符
  let nullIdx = offset;
  while (nullIdx < offset + length && view.getUint8(nullIdx) !== 0) nullIdx++;

  // keyword 总是 Latin-1 编码
  const keyword = readLatin1(view, offset, nullIdx);
  const textBytes = readBytes(view, nullIdx + 1, offset + length);

  console.log('[PNGParser] tEXt keyword:', keyword, 'length:', textBytes.length);

  // 智能编码检测：先尝试 UTF-8，如果无效则回退到 Latin-1
  if (isValidUtf8(textBytes)) {
    const text = new TextDecoder('utf-8').decode(textBytes);
    console.log('[PNGParser] tEXt decoded with: UTF-8');
    result[keyword] = text;
  } else {
    const text = new TextDecoder('latin1').decode(textBytes);
    console.log('[PNGParser] tEXt decoded with: Latin-1');
    result[keyword] = text;
  }

  return result;
}

// --- iTXt：可能压缩也可能未压缩 ---
async function extractITxtChunk(view, offset, length) {
  const result = {};
  const end = offset + length;

  // keyword（null 终止）
  let nullIdx = offset;
  while (nullIdx < end && view.getUint8(nullIdx) !== 0) nullIdx++;
  const keyword = readLatin1(view, offset, nullIdx);

  // compression flag（1 byte）：0=未压缩, 1=zlib 压缩
  let pos = nullIdx + 1;
  const compressionFlag = view.getUint8(pos);
  pos += 1;

  // compression method（1 byte）：0=deflate
  const compressionMethod = view.getUint8(pos);
  pos += 1;

  // language tag（null 终止，可跳过）
  while (pos < end && view.getUint8(pos) !== 0) pos++;
  pos++;

  // translated keyword（null 终止，可跳过）
  while (pos < end && view.getUint8(pos) !== 0) pos++;
  pos++;

  // 剩余全部是 text 数据
  const rawBytes = readBytes(view, pos, end);

  if (compressionFlag === 1 && rawBytes.length > 0) {
    // 已压缩，需要解压
    try {
      const decompressed = await decompressDeflate(rawBytes);
      // iTXt 规范要求使用 UTF-8
      if (isValidUtf8(decompressed)) {
        result[keyword] = new TextDecoder('utf-8').decode(decompressed);
        console.log('[PNGParser] iTXt decompressed with: UTF-8');
      } else {
        result[keyword] = new TextDecoder('latin1').decode(decompressed);
        console.log('[PNGParser] iTXt decompressed with: Latin-1 (UTF-8 invalid)');
      }
    } catch (err) {
      console.warn('[PNGParser] iTXt decompress failed, trying raw:', err);
      if (isValidUtf8(rawBytes)) {
        result[keyword] = new TextDecoder('utf-8').decode(rawBytes);
      } else {
        result[keyword] = new TextDecoder('latin1').decode(rawBytes);
      }
    }
  } else {
    // 未压缩，优先 UTF-8 解码
    if (isValidUtf8(rawBytes)) {
      result[keyword] = new TextDecoder('utf-8').decode(rawBytes);
      console.log('[PNGParser] iTXt decoded with: UTF-8');
    } else {
      result[keyword] = new TextDecoder('latin1').decode(rawBytes);
      console.log('[PNGParser] iTXt decoded with: Latin-1');
    }
  }

  return result;
}

// --- zTXt：zlib (deflate) 压缩文本 ---
async function extractZTxtChunk(view, offset, length) {
  const result = {};
  const end = offset + length;

  // keyword（null 终止）
  let nullIdx = offset;
  while (nullIdx < end && view.getUint8(nullIdx) !== 0) nullIdx++;
  const keyword = readLatin1(view, offset, nullIdx);

  // compression method（1 byte）
  const compressionMethod = view.getUint8(nullIdx + 1);

  // 压缩数据从 nullIdx+2 开始
  const compressedBytes = readBytes(view, nullIdx + 2, end);

  if (compressedBytes.length === 0) {
    result[keyword] = '';
    return result;
  }

  try {
    const decompressed = await decompressDeflate(compressedBytes);
    // 解压后智能检测编码
    if (isValidUtf8(decompressed)) {
      result[keyword] = new TextDecoder('utf-8').decode(decompressed);
      console.log('[PNGParser] zTXt decompressed with: UTF-8');
    } else {
      result[keyword] = new TextDecoder('latin1').decode(decompressed);
      console.log('[PNGParser] zTXt decompressed with: Latin-1');
    }
  } catch (err) {
    console.warn('[PNGParser] zTXt decompress failed:', err);
    // 回退：尝试直接读取
    if (isValidUtf8(compressedBytes)) {
      result[keyword] = new TextDecoder('utf-8').decode(compressedBytes);
    } else {
      result[keyword] = new TextDecoder('latin1').decode(compressedBytes);
    }
  }

  return result;
}

// ============================================================
//  解压缩工具
// ============================================================

async function decompressDeflate(uint8Array) {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(uint8Array);
  writer.close();

  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

// ============================================================
//  读取辅助
// ============================================================

function readLatin1(view, from, to) {
  const bytes = [];
  for (let i = from; i < to; i++) bytes.push(view.getUint8(i));
  return new TextDecoder('latin1').decode(new Uint8Array(bytes));
}

function readBytes(view, from, to) {
  const bytes = [];
  for (let i = from; i < to; i++) bytes.push(view.getUint8(i));
  return new Uint8Array(bytes);
}

// ============================================================
//  Base64 解码（Tavern PNG 的 chara 字段是 base64 编码的 JSON）
// ============================================================

function tryBase64Decode(str) {
  if (!str || typeof str !== 'string') return str;
  if (typeof str === 'object') return str;
  
  // 尝试 URL 安全 base64 转标准 base64
  function fixBase64(s) {
    return s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  }
  
  // 核心方法：atob \u2192 Uint8Array \u2192 TextDecoder(utf-8) \u2192 JSON.parse
  function base64ToUtf8Json(fixed) {
    const binary = atob(fixed);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const utf8 = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(utf8);
  }
  
  // 1. 尝试直接 JSON.parse\uff08已经是明文 JSON\uff09
  try {
    if (str.trim().startsWith('{')) {
      const obj = JSON.parse(str);
      if (obj && obj.name) {
        console.log('[PNGParser] method=direct-json');
        return obj;
      }
    }
  } catch(e) {}
  
  // 2. 标准 base64 \u2192 UTF-8 \u2192 JSON
  try {
    const obj = base64ToUtf8Json(str.trim());
    console.log('[PNGParser] method=atob-utf8-json');
    return obj;
  } catch(e) {}
  
  // 3. URL 安全 base64 \u2192 UTF-8 \u2192 JSON
  try {
    const obj = base64ToUtf8Json(fixBase64(str));
    console.log('[PNGParser] method=urlsafe-atob-utf8-json');
    return obj;
  } catch(e) {}
  
  // 4. 最后兜底：atob + JSON.parse\uff08仅用于ASCII内容\uff09
  try {
    const decoded = atob(fixBase64(str));
    const obj = JSON.parse(decoded);
    console.log('[PNGParser] method=atob-json-fallback');
    return obj;
  } catch(e) {}
  
  return str;
}

// ============================================================
//  角色元数据解析
// ============================================================

function parseCharacterMetadata(metadata) {
  const result = {
    name: '', description: '', personality: '', scenario: '',
    first_mes: '', mes_example: '', creator_notes: '',
    system_prompt: '', post_history_instructions: '',
    alternate_greetings: [], tags: [],
    creator: '', character_version: '',
    extensions: {}, worldbook: [],
    _raw: metadata,
  };

  // 按优先级处理不同格式
  const cardFields = ['chara', 'ccv3', 'character', 'tavern'];

  for (const field of cardFields) {
    if (metadata[field]) {
      const decoded = tryBase64Decode(metadata[field]);
      if (typeof decoded === 'object' && decoded !== null) {
        console.log('[PNGParser] Decoded', field + ', keys:', Object.keys(decoded));

        // ccv3 格式有 data 子对象
        if (decoded.data && typeof decoded.data === 'object') {
          Object.assign(result, decoded.data);
          if (decoded.name) result.name = decoded.name;
        } else {
          Object.assign(result, decoded);
        }
        // 找到有效数据后停止
        if (result.name) break;
      }
    }
  }

  // 确保所有字段都存在，统一命名
  const finalResult = {
    name: result.name || '未知角色',
    description: result.description || '',
    personality: result.personality || '',
    scenario: result.scenario || '',
    first_mes: result.first_mes || result.firstMessage || '',
    mes_example: result.mes_example || result.mesExample || result.exampleDialogue || '',
    creator_notes: result.creator_notes || result.creatorNotes || '',
    system_prompt: result.system_prompt || result.systemPrompt || '',
    post_history_instructions: result.post_history_instructions || '',
    alternate_greetings: result.alternate_greetings || [],
    tags: result.tags || [],
    creator: result.creator || '',
    character_version: result.character_version || result.characterVersion || '',
    extensions: result.extensions || {},
    worldbook: result.worldbook || result.character_book || [],
    _raw: metadata,
  };

  // 调试日志：显示解析结果
  console.log('[PNGParser] Character name:', finalResult.name);
  console.log('[PNGParser] first_mes preview:', finalResult.first_mes ? finalResult.first_mes.substring(0, 50) : 'empty');
  console.log('[PNGParser] personality preview:', finalResult.personality ? finalResult.personality.substring(0, 50) : 'empty');
  console.log('[PNGParser] scenario preview:', finalResult.scenario ? finalResult.scenario.substring(0, 50) : 'empty');
  console.log('[PNGParser] tags:', finalResult.tags);
  console.log('[PNGParser] hasWorldbook:', !!(finalResult.worldbook && finalResult.worldbook.length));

  return finalResult;
}
