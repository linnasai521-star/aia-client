// 角色卡解析模块 - 支持 JSON 和 PNG 格式
// SillyTavern PNG 角色卡格式

// 从 PNG 文件解析角色卡
export async function parseCharacterPNG(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  
  // 验证 PNG 签名
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
    throw new Error('不是有效的 PNG 文件');
  }
  
  const chunks = extractPngTextChunks(bytes);
  
  for (const chunk of chunks) {
    // 查找角色卡数据
    if (chunk.keyword === 'chara' || chunk.keyword === 'ccv3' || chunk.keyword === 'character') {
      try {
        // 尝试 base64 解码
        const decoded = atob(chunk.text.trim());
        const json = JSON.parse(decoded);
        return parseCardData(json);
      } catch {
        try {
          // 直接解析 JSON
          const json = JSON.parse(chunk.text);
          return parseCardData(json);
        } catch {
          continue;
        }
      }
    }
  }
  
  throw new Error('PNG 中未找到角色卡数据');
}

// 提取 PNG 文本块
function extractPngTextChunks(bytes) {
  const chunks = [];
  let offset = 8; // 跳过 PNG 签名
  
  while (offset < bytes.length - 12) {
    // 读取块长度（大端序）
    const length = (bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3];
    // 读取块类型
    const type = String.fromCharCode(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);
    
    // 处理文本块
    if (type === 'tEXt' || type === 'iTXt') {
      const data = bytes.slice(offset+8, offset+8+length);
      const nullIdx = data.indexOf(0);
      
      if (nullIdx > 0) {
        const keyword = String.fromCharCode(...data.slice(0, nullIdx));
        let text;
        
        if (type === 'tEXt') {
          text = String.fromCharCode(...data.slice(nullIdx+1));
        } else {
          // iTXt: 跳过压缩标志、语言标签、翻译关键词
          let pos = nullIdx + 1;
          const compressionMethod = data[pos++];
          const languageTag = '';
          const translatedKeyword = '';
          
          // 跳过语言标签
          while (pos < data.length && data[pos] !== 0) pos++;
          pos++; // 跳过 null
          
          // 跳过翻译关键词
          while (pos < data.length && data[pos] !== 0) pos++;
          pos++; // 跳过 null
          
          // 读取文本内容
          text = String.fromCharCode(...data.slice(pos));
        }
        
        chunks.push({ keyword, text, type });
      }
    }
    
    // 跳到下一个块：长度(4) + 类型(4) + 数据(length) + CRC(4)
    offset += 12 + length;
    
    // 遇到 IEND 块就结束
    if (type === 'IEND') break;
  }
  
  return chunks;
}

// 解析角色卡数据（统一处理 SillyTavern 格式）
function parseCardData(json) {
  // 处理 SillyTavern V2 格式
  if (json.data) {
    return parseCardData(json.data);
  }
  
  // 处理角色卡 V3 格式
  if (json.spec === 'chara_card_v2' || json.spec === 'chara_card_v3') {
    return {
      id: crypto.randomUUID(),
      name: json.data?.name || json.name || 'Unknown',
      description: json.data?.description || '',
      personality: json.data?.personality || '',
      systemPrompt: json.data?.system_prompt || json.data?.systemPrompt || '',
      firstMessage: json.data?.first_mes || json.data?.firstMessage || '',
      exampleDialogue: json.data?.mes_example || json.data?.exampleDialogue || '',
      creatorNotes: json.data?.creator_notes || json.data?.creatorNotes || '',
      tags: json.data?.tags || [],
      creator: json.data?.creator || '',
      characterVersion: json.data?.character_version || '',
      worldBook: json.data?.character_book || null,
      avatar: json.data?.avatar || null,
      createdAt: Date.now(),
    };
  }
  
  // 处理通用格式
  return {
    id: crypto.randomUUID(),
    name: json.name || json.char_name || 'Unknown',
    description: json.description || json.char_persona || '',
    personality: json.personality || '',
    systemPrompt: json.system_prompt || json.systemPrompt || json.personality || '',
    firstMessage: json.first_mes || json.firstMessage || '',
    exampleDialogue: json.mes_example || json.exampleDialogue || '',
    creatorNotes: json.creator_notes || json.creatorNotes || '',
    tags: json.tags || [],
    creator: json.creator || '',
    characterVersion: json.character_version || '',
    worldBook: json.character_book || json.lorebook || null,
    avatar: json.avatar || null,
    createdAt: Date.now(),
  };
}

// 处理世界书
export function parseWorldBook(worldBookData) {
  if (!worldBookData) return [];
  
  const entries = [];
  
  if (worldBookData.entries) {
    // SillyTavern 格式
    for (const [key, entry] of Object.entries(worldBookData.entries)) {
      entries.push({
        id: crypto.randomUUID(),
        convId: '_global',
        keywords: entry.keys || entry.key || [],
        content: entry.content || '',
        constant: entry.constant || false,
        enabled: entry.enabled !== false,
        priority: entry.insertion_order || 3,
      });
    }
  } else if (Array.isArray(worldBookData)) {
    // 数组格式
    for (const entry of worldBookData) {
      entries.push({
        id: crypto.randomUUID(),
        convId: '_global',
        keywords: entry.keywords || entry.keys || [],
        content: entry.content || '',
        constant: entry.constant || false,
        enabled: entry.enabled !== false,
        priority: entry.priority || 3,
      });
    }
  }
  
  return entries;
}