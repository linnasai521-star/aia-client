/**
 * LoreBook Engine
 * 处理世界书导入、关键词触发和上下文注入
 */

/**
 * 世界书条目结构
 * @typedef {Object} LoreBookEntry
 * @property {string} id - 唯一标识
 * @property {string} key - 触发关键词（逗号分隔）
 * @property {string} comment - 条目名称/备注
 * @property {string} content - 条目内容
 * @property {boolean} constant - 是否常驻注入
 * @property {number} priority - 优先级（数字越大优先级越高）
 * @property {number} insertionOrder - 插入顺序
 * @property {number} maxTokens - 最大Token数
 * @property {boolean} enabled - 是否启用
 * @property {string[]} keys - 解析后的关键词数组
 * @property {Object} metadata - 额外元数据
 */

/**
 * LoreBook引擎类
 */
export class LoreBookEngine {
  constructor() {
    this.entries = new Map();
    this.lastTriggered = new Map();
    this.tokenBudget = 2000;
    this.maxEntries = 10;
  }
  
  /**
   * 从JSON导入世界书
   * @param {Object|string} data - JSON数据
   * @returns {LoreBookEntry[]}
   */
  importFromJSON(data) {
    try {
      const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
      const entries = [];
      
      // SillyTavern格式
      if (jsonData.entries) {
        for (const [id, entry] of Object.entries(jsonData.entries)) {
          entries.push(this.normalizeEntry({
            id: id,
            key: entry.key || entry.keys || '',
            comment: entry.comment || entry.name || '',
            content: entry.content || entry.value || '',
            constant: entry.constant || false,
            priority: entry.priority || 0,
            insertionOrder: entry.insertion_order || entry.order || 0,
            enabled: entry.enabled !== false,
            metadata: entry.extensions || {}
          }));
        }
      }
      // TavernCard V2格式
      else if (jsonData.data && jsonData.data.character_book) {
        const book = jsonData.data.character_book;
        if (book.entries) {
          for (const entry of book.entries) {
            entries.push(this.normalizeEntry({
              id: entry.id || String(Math.random()),
              key: entry.keys?.join(',') || '',
              comment: entry.comment || '',
              content: entry.content || '',
              constant: entry.constant || false,
              priority: entry.priority || 0,
              insertionOrder: entry.insertion_order || 0,
              enabled: entry.enabled !== false,
              metadata: entry.extensions || {}
            }));
          }
        }
      }
      // 通用格式
      else if (Array.isArray(jsonData)) {
        for (const entry of jsonData) {
          entries.push(this.normalizeEntry(entry));
        }
      }
      
      return entries;
    } catch (e) {
      console.error('导入世界书失败:', e);
      return [];
    }
  }
  
  /**
   * 从PNG元数据中提取世界书
   * @param {Object} metadata - PNG元数据
   * @returns {LoreBookEntry[]}
   */
  extractFromPNGMetadata(metadata) {
    const entries = [];
    
    // 检查chara字段中的世界书
    if (metadata.chara) {
      try {
        const chara = JSON.parse(metadata.chara);
        if (chara.character_book) {
          const bookEntries = this.importFromJSON({ data: { character_book: chara.character_book } });
          entries.push(...bookEntries);
        }
        if (chara.extensions?.world) {
          const worldEntries = this.importFromJSON(chara.extensions.world);
          entries.push(...worldEntries);
        }
      } catch (e) {
        console.warn('解析chara世界书失败:', e);
      }
    }
    
    // 检查world字段
    if (metadata.world) {
      try {
        const worldData = typeof metadata.world === 'string' ? JSON.parse(metadata.world) : metadata.world;
        const worldEntries = this.importFromJSON(worldData);
        entries.push(...worldEntries);
      } catch (e) {
        console.warn('解析world字段失败:', e);
      }
    }
    
    return entries;
  }
  
  /**
   * 标准化世界书条目
   */
  normalizeEntry(entry) {
    const keys = typeof entry.key === 'string' ? 
      entry.key.split(',').map(k => k.trim().toLowerCase()).filter(k => k) :
      Array.isArray(entry.key) ? entry.key : [];
    
    return {
      id: entry.id || String(Date.now() + Math.random()),
      key: entry.key || '',
      keys: keys,
      comment: entry.comment || '',
      content: entry.content || '',
      constant: Boolean(entry.constant),
      priority: Number(entry.priority) || 0,
      insertionOrder: Number(entry.insertionOrder) || 0,
      maxTokens: Number(entry.maxTokens) || 500,
      enabled: entry.enabled !== false,
      metadata: entry.metadata || {}
    };
  }
  
  /**
   * 添加世界书条目
   * @param {LoreBookEntry} entry
   */
  addEntry(entry) {
    const normalized = this.normalizeEntry(entry);
    this.entries.set(normalized.id, normalized);
  }
  
  /**
   * 批量添加条目
   * @param {LoreBookEntry[]} entries
   */
  addEntries(entries) {
    for (const entry of entries) {
      this.addEntry(entry);
    }
  }
  
  /**
   * 清除所有条目
   */
  clear() {
    this.entries.clear();
    this.lastTriggered.clear();
  }
  
  /**
   * 获取所有条目
   * @returns {LoreBookEntry[]}
   */
  getAllEntries() {
    return Array.from(this.entries.values());
  }
  
  /**
   * 获取启用的条目
   * @returns {LoreBookEntry[]}
   */
  getEnabledEntries() {
    return this.getAllEntries().filter(e => e.enabled);
  }
  
  /**
   * 基于文本触发世界书条目
   * @param {string} text - 要分析的文本
   * @param {Object} options - 配置选项
   * @returns {LoreBookEntry[]}
   */
  trigger(text, options = {}) {
    const { includeConstant = true, maxEntries = this.maxEntries } = options;
    const triggered = [];
    const lowerText = text.toLowerCase();
    
    for (const entry of this.getEnabledEntries()) {
      // 常驻条目
      if (includeConstant && entry.constant) {
        triggered.push(entry);
        continue;
      }
      
      // 关键词匹配
      if (entry.keys.length > 0) {
        const matched = entry.keys.some(key => lowerText.includes(key));
        if (matched) {
          // 检查是否最近已触发（避免重复）
          const lastTime = this.lastTriggered.get(entry.id) || 0;
          const now = Date.now();
          if (now - lastTime > 60000) { // 1分钟冷却
            triggered.push(entry);
            this.lastTriggered.set(entry.id, now);
          }
        }
      }
    }
    
    // 按优先级排序，然后按插入顺序
    triggered.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.insertionOrder - b.insertionOrder;
    });
    
    return triggered.slice(0, maxEntries);
  }
  
  /**
   * 生成世界书上下文
   * @param {string} text - 触发文本
   * @param {number} tokenBudget - Token预算
   * @returns {string}
   */
  generateContext(text, tokenBudget = this.tokenBudget) {
    const triggered = this.trigger(text);
    let context = '';
    let usedTokens = 0;
    
    for (const entry of triggered) {
      const entryTokens = this.estimateTokens(entry.content);
      if (usedTokens + entryTokens <= tokenBudget) {
        context += entry.content + '\n\n';
        usedTokens += entryTokens;
      }
    }
    
    return context.trim();
  }
  
  /**
   * 估算文本Token数（简单估算）
   */
  estimateTokens(text) {
    if (!text) return 0;
    // 简单估算：英文按空格分词，中文按字分词
    const englishWords = text.split(/\s+/).filter(w => w).length;
    const chineseChars = text.replace(/[^\u4e00-\u9fa5]/g, '').length;
    return Math.ceil(englishWords * 1.3 + chineseChars * 2);
  }
  
  /**
   * 导出世界书为JSON
   * @returns {Object}
   */
  exportToJSON() {
    const entries = {};
    for (const [id, entry] of this.entries) {
      entries[id] = {
        key: entry.key,
        keys: entry.keys,
        comment: entry.comment,
        content: entry.content,
        constant: entry.constant,
        priority: entry.priority,
        insertion_order: entry.insertionOrder,
        enabled: entry.enabled,
        extensions: entry.metadata
      };
    }
    return { entries };
  }
  
  /**
   * 从SillyTavern JSON导入
   * @param {string} jsonStr
   */
  importFromSillyTavern(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      return this.importFromJSON(data);
    } catch (e) {
      console.error('导入SillyTavern世界书失败:', e);
      return [];
    }
  }
  
  /**
   * 合并多个世界书
   * @param {LoreBookEngine[]} engines
   * @returns {LoreBookEngine}
   */
  static merge(engines) {
    const merged = new LoreBookEngine();
    for (const engine of engines) {
      for (const entry of engine.getAllEntries()) {
        merged.addEntry(entry);
      }
    }
    return merged;
  }
}

// 默认实例
export const globalLoreBook = new LoreBookEngine();
