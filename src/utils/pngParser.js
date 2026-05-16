/**
 * PNG Character Card Parser
 * 解析Tavern格式PNG元数据（tEXt、iTXt、zTXt chunks）
 * CRITICAL: Tavern PNG的chara字段是base64编码的JSON
 */

export async function parsePngCharacterCard(pngFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const metadata = await extractPngMetadata(arrayBuffer);
        const result = parseCharacterMetadata(metadata);
        console.log('[PNGParser] Parsed metadata:', Object.keys(metadata));
        console.log('[PNGParser] Result preview:', {name:result.name, desc:result.description?.slice(0,50), personality:result.personality?.slice(0,50), scenario:result.scenario?.slice(0,50), first_mes:result.first_mes?.slice(0,50), tags:result.tags, hasWorldbook:!!(result.worldbook?.length)});
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsArrayBuffer(pngFile);
  });
}

async function extractPngMetadata(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (dataView.getUint8(i) !== signature[i]) throw new Error('不是有效的PNG文件');
  }
  let offset = 8;
  const metadata = {};
  while (offset < arrayBuffer.byteLength) {
    const length = dataView.getUint32(offset); offset += 4;
    const chunkType = String.fromCharCode(
      dataView.getUint8(offset), dataView.getUint8(offset+1),
      dataView.getUint8(offset+2), dataView.getUint8(offset+3)
    ); offset += 4;
    if (chunkType === 'tEXt') Object.assign(metadata, extractTextChunk(dataView, offset, length));
    else if (chunkType === 'iTXt') Object.assign(metadata, extractITxtChunk(dataView, offset, length));
    else if (chunkType === 'zTXt') Object.assign(metadata, await extractZTxtChunk(dataView, offset, length));
    offset += length + 4;
    if (chunkType === 'IEND') break;
  }
  return metadata;
}

function extractTextChunk(dataView, offset, length) {
  const result = {};
  let nullIndex = offset;
  while (nullIndex < offset + length && dataView.getUint8(nullIndex) !== 0) nullIndex++;
  const keywordBytes = []; for (let i=offset; i<nullIndex; i++) keywordBytes.push(dataView.getUint8(i));
  const keyword = new TextDecoder().decode(new Uint8Array(keywordBytes));
  const textBytes = []; for (let i=nullIndex+1; i<offset+length; i++) textBytes.push(dataView.getUint8(i));
  const text = new TextDecoder('latin1').decode(new Uint8Array(textBytes));
  result[keyword] = text;
  return result;
}

function extractITxtChunk(dataView, offset, length) {
  const result = {};
  let nullIndex = offset;
  while (nullIndex < offset + length && dataView.getUint8(nullIndex) !== 0) nullIndex++;
  const keywordBytes = []; for (let i=offset; i<nullIndex; i++) keywordBytes.push(dataView.getUint8(i));
  const keyword = new TextDecoder().decode(new Uint8Array(keywordBytes));
  let currentPos = nullIndex + 2;
  while (currentPos < offset + length && dataView.getUint8(currentPos) !== 0) currentPos++; currentPos++;
  while (currentPos < offset + length && dataView.getUint8(currentPos) !== 0) currentPos++; currentPos++;
  const textBytes = []; for (let i=currentPos; i<offset+length; i++) textBytes.push(dataView.getUint8(i));
  const text = new TextDecoder().decode(new Uint8Array(textBytes));
  result[keyword] = text;
  return result;
}

async function extractZTxtChunk(dataView, offset, length) {
  const result = {};
  let nullIndex = offset;
  while (nullIndex < offset + length && dataView.getUint8(nullIndex) !== 0) nullIndex++;
  const keywordBytes = []; for (let i=offset; i<nullIndex; i++) keywordBytes.push(dataView.getUint8(i));
  const keyword = new TextDecoder().decode(new Uint8Array(keywordBytes));
  const compressedData = []; for (let i=nullIndex+2; i<offset+length; i++) compressedData.push(dataView.getUint8(i));
  try {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter(); writer.write(new Uint8Array(compressedData)); writer.close();
    const reader = ds.readable.getReader(); const chunks = [];
    while (true) { const {done,value}=await reader.read(); if(done)break; chunks.push(value); }
    const decompressed = new Uint8Array(chunks.reduce((a,c)=>a+c.length,0));
    let pos=0; for(const c of chunks){decompressed.set(c,pos);pos+=c.length;}
    result[keyword] = new TextDecoder().decode(decompressed);
  } catch(e) {
    const textBytes = []; for (let i=nullIndex+2; i<offset+length; i++) textBytes.push(dataView.getUint8(i));
    result[keyword] = new TextDecoder('latin1').decode(new Uint8Array(textBytes));
  }
  return result;
}

// CRITICAL: Base64解码（Tavern PNG的chara字段是base64编码的JSON）
function tryBase64Decode(str) {
  if (!str || typeof str !== 'string') return str;
  try {
    // 尝试标准base64解码
    const decoded = atob(str);
    // 检查解码后是否为有效JSON
    if (decoded.startsWith('{') || decoded.startsWith('[')) {
      return JSON.parse(decoded);
    }
    return decoded;
  } catch(e) {
    // 不是base64，返回原始字符串
    return str;
  }
}

function parseCharacterMetadata(metadata) {
  console.log('[PNGParser] Raw metadata keys:', Object.keys(metadata));
  
  const result = {
    name: '', description: '', personality: '', scenario: '',
    first_mes: '', mes_example: '', creator_notes: '', system_prompt: '',
    post_history_instructions: '', alternate_greetings: [], tags: [],
    creator: '', character_version: '', extensions: {}, worldbook: [],
    _raw: metadata
  };

  // CRITICAL: 处理chara字段 - Tavern PNG的chara是base64编码的JSON
  if (metadata.chara) {
    const decoded = tryBase64Decode(metadata.chara);
    if (typeof decoded === 'object') {
      console.log('[PNGParser] Decoded chara (base64->JSON):', Object.keys(decoded));
      Object.assign(result, decoded);
    }
  }
  
  // 处理ccv3字段 (V3格式，也可能是base64)
  if (metadata.ccv3) {
    const decoded = tryBase64Decode(metadata.ccv3);
    if (typeof decoded === 'object') {
      console.log('[PNGParser] Decoded ccv3:', Object.keys(decoded));
      if (decoded.data) Object.assign(result, decoded.data);
      if (decoded.name) result.name = decoded.name;
    }
  }
  
  // 处理character字段 (V1格式)
  if (metadata.character && !result.name) {
    const decoded = tryBase64Decode(metadata.character);
    if (typeof decoded === 'object') {
      Object.assign(result, decoded);
    }
  }

  // 确保所有字段都存在
  return {
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
    _raw: metadata
  };
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
