/**
 * Token Context Manager
 * 管理上下文窗口，自动裁剪历史，控制Token使用
 */

export class TokenContextManager {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 4000;
    this.reserveTokens = options.reserveTokens || 500; // 为回复预留的Token
    this.systemPromptPriority = options.systemPromptPriority !== false;
    this.recentMessagesPriority = options.recentMessagesPriority !== false;
    this.loreBookPriority = options.loreBookPriority || 10;
    this.tokenEstimator = options.tokenEstimator || this.defaultTokenEstimator;
  }
  
  /**
   * 默认Token估算器
   */
  defaultTokenEstimator(text) {
    if (!text) return 0;
    // 简单估算：英文按空格分词，中文按字分词
    const englishWords = text.split(/\s+/).filter(w => w).length;
    const chineseChars = text.replace(/[^\u4e00-\u9fa5]/g, '').length;
    return Math.ceil(englishWords * 1.3 + chineseChars * 2);
  }
  
  /**
   * 估算消息数组的Token数
   */
  estimateMessagesTokens(messages) {
    let total = 0;
    for (const msg of messages) {
      total += this.tokenEstimator(msg.content);
      total += 4; // 角色标签等额外Token
    }
    return total;
  }
  
  /**
   * 估算单个文本的Token数
   */
  estimateTokens(text) {
    return this.tokenEstimator(text);
  }
  
  /**
   * 裁剪消息历史以适应Token限制
   * @param {Array} messages - 消息数组
   * @param {Object} options - 选项
   * @returns {Array} - 裁剪后的消息数组
   */
  trimMessages(messages, options = {}) {
    const {
      systemPrompt = '',
      loreBookEntries = [],
      characterCard = null,
      keepLastN = 10,
      minMessages = 2
    } = options;
    
    if (!messages || !messages.length) return [];
    
    // 计算固定部分的Token（系统提示、角色卡、世界书）
    let fixedTokens = 0;
    fixedTokens += this.tokenEstimator(systemPrompt);
    
    if (characterCard) {
      fixedTokens += this.tokenEstimator(characterCard.description || '');
      fixedTokens += this.tokenEstimator(characterCard.personality || '');
      fixedTokens += this.tokenEstimator(characterCard.scenario || '');
    }
    
    for (const entry of loreBookEntries) {
      fixedTokens += this.tokenEstimator(entry.content || '');
    }
    
    // 计算可用Token
    const availableTokens = this.maxTokens - fixedTokens - this.reserveTokens;
    if (availableTokens <= 0) {
      console.warn('固定内容已超过Token限制');
      return messages.slice(-minMessages);
    }
    
    // 从最新消息开始，计算需要保留多少消息
    let currentTokens = 0;
    let startIndex = messages.length - 1;
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.tokenEstimator(messages[i].content) + 4;
      if (currentTokens + msgTokens > availableTokens) {
        break;
      }
      currentTokens += msgTokens;
      startIndex = i;
      
      // 确保至少保留指定数量的消息
      if (messages.length - i >= keepLastN) {
        break;
      }
    }
    
    // 确保至少保留最小消息数
    if (messages.length - startIndex < minMessages) {
      startIndex = Math.max(0, messages.length - minMessages);
    }
    
    return messages.slice(startIndex);
  }
  
  /**
   * 管理完整上下文
   * @param {Object} context - 上下文对象
   * @returns {Object} - 管理后的上下文
   */
  manageContext(context) {
    const {
      systemPrompt = '',
      messages = [],
      loreBook = [],
      characterCard = null,
      userPersona = null,
      authorNote = null,
      maxMessages = 50
    } = context;
    
    // 构建固定部分
    let fixedContent = '';
    
    // 系统提示
    if (systemPrompt) {
      fixedContent += systemPrompt + '\n\n';
    }
    
    // 角色卡信息
    if (characterCard) {
      if (characterCard.description) {
        fixedContent += `角色描述：${characterCard.description}\n\n`;
      }
      if (characterCard.personality) {
        fixedContent += `角色性格：${characterCard.personality}\n\n`;
      }
      if (characterCard.scenario) {
        fixedContent += `场景设定：${characterCard.scenario}\n\n`;
      }
    }
    
    // 用户人设
    if (userPersona) {
      fixedContent += `用户人设：${userPersona}\n\n`;
    }
    
    // 作者备注
    if (authorNote) {
      fixedContent += `作者备注：${authorNote}\n\n`;
    }
    
    // 世界书（按优先级排序）
    const sortedLoreBook = [...loreBook].sort((a, b) => {
      return (b.priority || 0) - (a.priority || 0);
    });
    
    for (const entry of sortedLoreBook) {
      if (entry.content) {
        fixedContent += entry.content + '\n\n';
      }
    }
    
    // 裁剪消息历史
    const trimmedMessages = this.trimMessages(messages, {
      systemPrompt: fixedContent,
      keepLastN: Math.min(maxMessages, 20),
      minMessages: 2
    });
    
    return {
      systemPrompt: fixedContent.trim(),
      messages: trimmedMessages,
      tokenEstimate: {
        system: this.tokenEstimator(fixedContent),
        messages: this.estimateMessagesTokens(trimmedMessages),
        total: this.tokenEstimator(fixedContent) + this.estimateMessagesTokens(trimmedMessages)
      }
    };
  }
  
  /**
   * 检查是否需要裁剪
   */
  shouldTrim(context) {
    const { messages = [], systemPrompt = '' } = context;
    const totalTokens = this.tokenEstimator(systemPrompt) + this.estimateMessagesTokens(messages);
    return totalTokens > this.maxTokens - this.reserveTokens;
  }
  
  /**
   * 获取Token使用统计
   */
  getTokenStats(context) {
    const { messages = [], systemPrompt = '' } = context;
    const systemTokens = this.tokenEstimator(systemPrompt);
    const messageTokens = this.estimateMessagesTokens(messages);
    const total = systemTokens + messageTokens;
    
    return {
      system: systemTokens,
      messages: messageTokens,
      total: total,
      available: this.maxTokens - total,
      usagePercent: (total / this.maxTokens) * 100
    };
  }
  
  /**
   * 自动优化上下文
   */
  optimizeContext(context, targetTokens = null) {
    const target = targetTokens || this.maxTokens - this.reserveTokens;
    let optimized = { ...context };
    
    // 如果超过目标，逐步裁剪
    while (this.shouldTrim(optimized) && optimized.messages.length > 2) {
      // 移除最早的消息
      optimized.messages = optimized.messages.slice(1);
      
      // 重新计算
      const stats = this.getTokenStats(optimized);
      if (stats.total <= target) {
        break;
      }
    }
    
    return optimized;
  }
}

// 默认实例
export const globalTokenManager = new TokenContextManager();
