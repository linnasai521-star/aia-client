/**
 * Prompt Assembler
 * 负责按照 SillyTavern 兼容格式拼装完整 Prompt
 */

import { LoreBookEngine } from './lorebookEngine.js';

/**
 * Prompt 组件类型
 */
export const PromptComponents = {
  SYSTEM: 'system',
  CHARACTER_DESCRIPTION: 'character_description',
  CHARACTER_PERSONALITY: 'character_personality',
  CHARACTER_SCENARIO: 'character_scenario',
  CHARACTER_FIRST_MESSAGE: 'character_first_message',
  CHARACTER_EXAMPLE_DIALOGUE: 'character_example_dialogue',
  AUTHOR_NOTE: 'author_note',
  LOREBOOK: 'lorebook',
  USER_PERSONA: 'user_persona',
  JAILBREAK: 'jailbreak',
  CHAT_HISTORY: 'chat_history',
  STYLE_PROMPT: 'style_prompt'
};

/**
 * Prompt 拼装器
 */
export class PromptAssembler {
  constructor() {
    this.components = new Map();
    this.loreBookEngine = new LoreBookEngine();
    this.order = [
      PromptComponents.SYSTEM,
      PromptComponents.CHARACTER_DESCRIPTION,
      PromptComponents.CHARACTER_PERSONALITY,
      PromptComponents.CHARACTER_SCENARIO,
      PromptComponents.AUTHOR_NOTE,
      PromptComponents.LOREBOOK,
      PromptComponents.USER_PERSONA,
      PromptComponents.JAILBREAK,
      PromptComponents.STYLE_PROMPT,
      PromptComponents.CHARACTER_EXAMPLE_DIALOGUE,
      PromptComponents.CHAT_HISTORY,
      PromptComponents.CHARACTER_FIRST_MESSAGE
    ];
  }
  
  /**
   * 设置组件内容
   * @param {string} type - 组件类型
   * @param {string} content - 内容
   * @param {Object} options - 选项
   */
  setComponent(type, content, options = {}) {
    if (!content || !content.trim()) return;
    this.components.set(type, {
      content: content.trim(),
      priority: options.priority || 0,
      enabled: options.enabled !== false,
      metadata: options.metadata || {}
    });
  }
  
  /**
   * 获取组件内容
   * @param {string} type
   * @returns {string|null}
   */
  getComponent(type) {
    const component = this.components.get(type);
    return component?.enabled ? component.content : null;
  }
  
  /**
   * 移除组件
   * @param {string} type
   */
  removeComponent(type) {
    this.components.delete(type);
  }
  
  /**
   * 设置组件顺序
   * @param {string[]} order
   */
  setOrder(order) {
    this.order = order.filter(type => Object.values(PromptComponents).includes(type));
  }
  
  /**
   * 从角色卡设置组件
   * @param {Object} characterCard - 角色卡数据
   */
  setFromCharacterCard(characterCard) {
    if (!characterCard) return;
    
    // 系统提示
    if (characterCard.system_prompt) {
      this.setComponent(PromptComponents.SYSTEM, characterCard.system_prompt);
    }
    
    // 角色描述
    if (characterCard.description) {
      this.setComponent(PromptComponents.CHARACTER_DESCRIPTION, characterCard.description);
    }
    
    // 角色性格
    if (characterCard.personality) {
      this.setComponent(PromptComponents.CHARACTER_PERSONALITY, `性格：${characterCard.personality}`);
    }
    
    // 角色场景
    if (characterCard.scenario) {
      this.setComponent(PromptComponents.CHARACTER_SCENARIO, `场景：${characterCard.scenario}`);
    }
    
    // 示例对话
    if (characterCard.mes_example) {
      this.setComponent(PromptComponents.CHARACTER_EXAMPLE_DIALOGUE, characterCard.mes_example);
    }
    
    // 作者备注
    if (characterCard.creator_notes) {
      this.setComponent(PromptComponents.AUTHOR_NOTE, characterCard.creator_notes);
    }
    
    // 世界书
    if (characterCard.worldbook && Array.isArray(characterCard.worldbook)) {
      this.loreBookEngine.clear();
      const entries = this.loreBookEngine.importFromJSON(characterCard.worldbook);
      this.loreBookEngine.addEntries(entries);
    }
  }
  
  /**
   * 设置用户消息触发的LoreBook
   * @param {string} userMessage - 用户消息
   * @param {number} tokenBudget - Token预算
   */
  setLoreBookContext(userMessage, tokenBudget = 2000) {
    if (!userMessage) return;
    const loreContext = this.loreBookEngine.generateContext(userMessage, tokenBudget);
    if (loreContext) {
      this.setComponent(PromptComponents.LOREBOOK, loreContext);
    }
  }
  
  /**
   * 设置聊天历史
   * @param {Array} messages - 消息数组
   * @param {number} maxMessages - 最大消息数
   */
  setChatHistory(messages, maxMessages = 50) {
    if (!messages || !messages.length) return;
    
    const recentMessages = messages.slice(-maxMessages);
    let history = '';
    
    for (const msg of recentMessages) {
      const role = msg.role === 'user' ? 'User' : 'Character';
      history += `${role}: ${msg.content}\n`;
    }
    
    this.setComponent(PromptComponents.CHAT_HISTORY, history);
  }
  
  /**
   * 拼装完整 Prompt
   * @param {Object} options - 选项
   * @returns {Object} - { system, messages }
   */
  assemble(options = {}) {
    const { 
      systemSuffix = '',
      messagePrefix = '',
      messageSuffix = '',
      includeSystemInMessages = false
    } = options;
    
    let systemPrompt = '';
    let messages = [];
    
    // 按照顺序组装系统提示
    for (const type of this.order) {
      const component = this.components.get(type);
      if (!component || !component.enabled) continue;
      
      if (type === PromptComponents.CHARACTER_FIRST_MESSAGE && component.content) {
        // 第一条消息作为 assistant 消息
        messages.push({
          role: 'assistant',
          content: component.content
        });
      } else if (type === PromptComponents.CHAT_HISTORY && component.content) {
        // 聊天历史需要特殊处理
        continue; // 我们会在后面单独处理
      } else if (component.content) {
        systemPrompt += component.content + '\n\n';
      }
    }
    
    // 添加聊天历史到 messages
    const chatHistory = this.getComponent(PromptComponents.CHAT_HISTORY);
    if (chatHistory) {
      // 解析聊天历史格式
      const lines = chatHistory.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.startsWith('User: ')) {
          messages.push({
            role: 'user',
            content: messagePrefix + line.slice(6) + messageSuffix
          });
        } else if (line.startsWith('Character: ')) {
          messages.push({
            role: 'assistant',
            content: line.slice(11)
          });
        }
      }
    }
    
    // 添加系统后缀
    if (systemSuffix) {
      systemPrompt += systemSuffix;
    }
    
    // 清理系统提示
    systemPrompt = systemPrompt.trim();
    
    // 如果包含系统消息在 messages 中
    if (includeSystemInMessages && systemPrompt) {
      messages.unshift({
        role: 'system',
        content: systemPrompt
      });
      systemPrompt = '';
    }
    
    return {
      system: systemPrompt,
      messages: messages
    };
  }
  
  /**
   * 估算 Token 数
   * @param {Object} assembled - 组装后的 prompt
   * @returns {number}
   */
  estimateTokens(assembled) {
    let tokens = 0;
    if (assembled.system) {
      tokens += this.loreBookEngine.estimateTokens(assembled.system);
    }
    for (const msg of assembled.messages) {
      tokens += this.loreBookEngine.estimateTokens(msg.content);
    }
    return tokens;
  }
  
  /**
   * 清空所有组件
   */
  clear() {
    this.components.clear();
    this.loreBookEngine.clear();
  }
  
  /**
   * 导出配置
   * @returns {Object}
   */
  exportConfig() {
    const config = {
      components: {},
      order: this.order,
      loreBook: this.loreBookEngine.exportToJSON()
    };
    
    for (const [type, component] of this.components) {
      config.components[type] = {
        content: component.content,
        priority: component.priority,
        enabled: component.enabled
      };
    }
    
    return config;
  }
  
  /**
   * 导入配置
   * @param {Object} config
   */
  importConfig(config) {
    if (config.components) {
      for (const [type, data] of Object.entries(config.components)) {
        this.setComponent(type, data.content, data);
      }
    }
    if (config.order) {
      this.setOrder(config.order);
    }
    if (config.loreBook) {
      this.loreBookEngine.clear();
      const entries = this.loreBookEngine.importFromJSON(config.loreBook);
      this.loreBookEngine.addEntries(entries);
    }
  }
}

// 默认实例
export const globalPromptAssembler = new PromptAssembler();
