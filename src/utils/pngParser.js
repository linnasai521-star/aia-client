/**
 * PNG Character Card Parser
 * 解析Tavern格式PNG元数据（tEXt、iTXt、zTXt chunks）
 */

/**
 * 解析PNG文件，提取角色卡数据
 * @param {File|Blob} pngFile - PNG文件
 * @returns {Promise<Object>} 角色卡数据
 */
export async function parsePngCharacterCard(pngFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const data = await extractPngMetadata(arrayBuffer);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsArrayBuffer(pngFile);
  });
}

/**
 * 从ArrayBuffer中提取PNG元数据
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<Object>}
 */
async function extractPngMetadata(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  
  // 验证PNG签名
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (dataView.getUint8(i) !== signature[i]) {
      throw new Error('不是有效的PNG文件');
    }
  }
  
  let offset = 8;
  const metadata = {};
  
  while (offset < arrayBuffer.byteLength) {
    // 读取chunk长度（4字节）
    const length = dataView.getUint32(offset);
    offset += 4;
    
    // 读取chunk类型（4字节）
    const chunkType = String.fromCharCode(
      dataView.getUint8(offset),
      dataView.getUint8(offset + 1),
      dataView.getUint8(offset + 2),
      dataView.getUint8(offset + 3)
    );
    offset += 4;
    
    // 处理元数据chunks
    if (chunkType === 'tEXt') {
      const textData = extractTextChunk(dataView, offset, length);
      Object.assign(metadata, textData);
    } else if (chunkType === 'iTXt') {
      const iTxtData = extractITxtChunk(dataView, offset, length);
      Object.assign(metadata, iTxtData);
    } else if (chunkType === 'zTXt') {
      const zTxtData = await extractZTxtChunk(dataView, offset, length);
      Object.assign(metadata, zTxtData);
    }
    
    // 跳过数据 + CRC（4字节）
    offset += length + 4;
    
    // 如果到达IEND chunk，停止解析
    if (chunkType === 'IEND') {
      break;
    }
  }
  
  return parseCharacterMetadata(metadata);
}

/**
 * 提取tEXt chunk数据
 */
function extractTextChunk(dataView, offset, length) {
  const result = {};
  
  // 找到null分隔符
  let nullIndex = offset;
  while (nullIndex < offset + length && dataView.getUint8(nullIndex) !== 0) {
    nullIndex++;
  }
  
  // 提取keyword
  const keywordBytes = [];
  for (let i = offset; i < nullIndex; i++) {
    keywordBytes.push(dataView.getUint8(i));
  }
  const keyword = new TextDecoder().decode(new Uint8Array(keywordBytes));
  
  // 提取text（Latin-1编码）
  const textBytes = [];
  for (let i = nullIndex + 1; i < offset + length; i++) {
    textBytes.push(dataView.getUint8(i));
  }
  const text = new TextDecoder('latin1').decode(new Uint8Array(textBytes));
  
  result[keyword] = text;
  return result;
}

/**
 * 提取iTXt chunk数据（国际化文本）
 */
function extractITxtChunk(dataView, offset, length) {
  const result = {};
  
  // 找到keyword的null分隔符
  let nullIndex = offset;
  while (nullIndex < offset + length && dataView.getUint8(nullIndex) !== 0) {
    nullIndex++;
  }
  
  // 提取keyword
  const keywordBytes = [];
  for (let i = offset; i < nullIndex; i++) {
    keywordBytes.push(dataView.getUint8(i));
  }
  const keyword = new TextDecoder().decode(new Uint8Array(keywordBytes));
  
  // 跳过compression flag和method
  let currentPos = nullIndex + 2;
  
  // 跳过language tag（找到null分隔符）
  while (currentPos < offset + length && dataView.getUint8(currentPos) !== 0) {
    currentPos++;
  }
  currentPos++;
  
  // 跳过translated keyword（找到null分隔符）
  while (currentPos < offset + length && dataView.getUint8(currentPos) !== 0) {
    currentPos++;
  }
  currentPos++;
  
  // 提取text（UTF-8编码）
  const textBytes = [];
  for (let i = currentPos; i < offset + length; i++) {
    textBytes.push(dataView.getUint8(i));
  }
  const text = new TextDecoder().decode(new Uint8Array(textBytes));
  
  result[keyword] = text;
  return result;
}

/**
 * 提取zTXt chunk数据（压缩文本）
 */
async function extractZTxtChunk(dataView, offset, length) {
  const result = {};
  
  // 找到null分隔符
  let nullIndex = offset;
  while (nullIndex < offset + length && dataView.getUint8(nullIndex) !== 0) {
    nullIndex++;
  }
  
  // 提取keyword
  const keywordBytes = [];
  for (let i = offset; i < nullIndex; i++) {
    keywordBytes.push(dataView.getUint8(i));
  }
  const keyword = new TextDecoder().decode(new Uint8Array(keywordBytes));
  
  // 跳过compression method
  const compressionMethod = dataView.getUint8(nullIndex + 1);
  
  // 提取压缩数据
  const compressedData = [];
  for (let i = nullIndex + 2; i < offset + length; i++) {
    compressedData.push(dataView.getUint8(i));
  }
  
  try {
    // 使用DecompressionStream解压（现代浏览器支持）
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    
    writer.write(new Uint8Array(compressedData));
    writer.close();
    
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let pos = 0;
    for (const chunk of chunks) {
      decompressed.set(chunk, pos);
      pos += chunk.length;
    }
    
    const text = new TextDecoder().decode(decompressed);
    result[keyword] = text;
  } catch (error) {
    console.warn('解压zTXt失败，尝试直接读取:', error);
    // 回退：尝试直接读取为Latin-1
    const textBytes = [];
    for (let i = nullIndex + 2; i < offset + length; i++) {
      textBytes.push(dataView.getUint8(i));
    }
    const text = new TextDecoder('latin1').decode(new Uint8Array(textBytes));
    result[keyword] = text;
  }
  
  return result;
}

/**
 * 解析角色元数据
 */
function parseCharacterMetadata(metadata) {
  const result = {
    name: '',
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
    creator_notes: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    tags: [],
    creator: '',
    character_version: '',
    extensions: {},
    worldbook: [],
    _raw: metadata
  };
  
  // 尝试不同的关键词格式
  const possibleKeys = [
    'chara', 'ccv3', 'character', 'tavern', 'sillytavern',
    'Description', 'Personality', 'Scenario', 'First_mes',
    'Mes_example', 'Creator_notes', 'System_prompt',
    'Post_history_instructions', 'Alternate_greetings',
    'Tags', 'Creator', 'Character_version', 'extensions'
  ];
  
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    
    // 检查是否为角色数据字段
    if (possibleKeys.some(pk => lowerKey === pk.toLowerCase())) {
      try {
        // 尝试解析JSON
        let parsed = value;
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          parsed = JSON.parse(value);
        }
        
        // 根据字段名赋值
        if (lowerKey === 'chara' || lowerKey === 'character' || lowerKey === 'tavern') {
          if (typeof parsed === 'object') {
            Object.assign(result, parsed);
          }
        } else if (lowerKey === 'ccv3') {
          // V3格式
          if (typeof parsed === 'object') {
            if (parsed.data) Object.assign(result, parsed.data);
            if (parsed.name) result.name = parsed.name;
          }
        }
      } catch (e) {
        // 如果不是JSON，直接赋值
        result[lowerKey] = value;
      }
    }
  }
  
  // 确保必要字段存在
  if (!result.name && metadata['chara']) {
    try {
      const chara = JSON.parse(metadata['chara']);
      result.name = chara.name || '未知角色';
    } catch (e) {
      result.name = '未知角色';
    }
  }
  
  return result;
}

/**
 * 验证是否为SillyTavern格式的角色卡
 */
export function isSillyTavernCharacterCard(metadata) {
  return metadata.chara || metadata.ccv3 || metadata.character || metadata.tavern;
}

/**
 * 获取角色卡版本
 */
export function getCharacterCardVersion(metadata) {
  if (metadata.ccv3) return 'v3';
  if (metadata.chara) return 'v2';
  if (metadata.character) return 'v1';
  return 'unknown';
}
