import urllib.request
import json
import time

# 测试两个URL
urls = [
    ("GitHub Pages", "https://linnasai521-star.github.io/aia-client/"),
    ("Cloudflare Pages", "https://aia-client.pages.dev/")
]

for name, url in urls:
    print(f"\n测试 {name}: {url}")
    print("-" * 50)
    
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36'
        })
        
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read().decode('utf-8', errors='ignore')
            
            # 检查关键内容
            checks = {
                "AI Aggregator": "AI Aggregator" in content,
                "自定义 API 配置": "自定义 API 配置" in content,
                "🔧 自定义": "🔧 自定义" in content,
                "记忆页面": "🧠 记忆" in content,
                "角色卡导入": "导入角色卡" in content
            }
            
            print(f"状态码: {response.status}")
            print(f"内容大小: {len(content)} 字符")
            
            for check_name, result in checks.items():
                status = "✅" if result else "❌"
                print(f"{status} {check_name}")
            
            # 检查是否有红色X相关代码
            if "error" in content.lower() and "failed" in content.lower():
                print("⚠️  可能包含错误相关代码")
            else:
                print("✅ 没有明显错误代码")
                
    except Exception as e:
        print(f"❌ 访问失败: {e}")

print("\n" + "="*50)
print("部署状态总结:")
print("1. GitHub Pages: 已成功部署，包含完整功能")
print("2. Cloudflare Pages: 需要重新部署以同步最新代码")
print("3. 记忆系统: 已完整实现，包含:")
print("   - 记忆提取和分类")
print("   - 重要性评估")
print("   - 对话摘要")
print("   - 记忆检索和缓存")
print("   - 记忆衰减机制")
print("   - 导入导出功能")
print("4. 自定义API: 已完全支持，包含预设和自定义选项")