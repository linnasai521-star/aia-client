import urllib.request
import time

# 测试CSS文件URL
urls = [
    "https://linnasai521-star.github.io/aia-client/src/styles/immersive-theme.css",
    "https://linnasai521-star.github.io/aia-client/src/styles/reset.css",
    "https://linnasai521-star.github.io/aia-client/src/styles/theme.css"
]

print("测试CSS文件加载...")
print("="*60)

for url in urls:
    print(f"\n测试: {url}")
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Cache-Control': 'no-cache'
        })
        
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read().decode('utf-8', errors='ignore')
            print(f"  ✅ 状态码: {response.status}")
            print(f"  大小: {len(content)} 字节")
            print(f"  包含#0f1115: {'#0f1115' in content}")
            
    except Exception as e:
        print(f"  ❌ 错误: {e}")

print("\n" + "="*60)
print("建议:")
print("1. 清除浏览器缓存并强制刷新")
print("2. 等待几分钟让CDN更新")
print("3. 尝试在隐身窗口中访问")
print("4. 或者使用其他浏览器访问")