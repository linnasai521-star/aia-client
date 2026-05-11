import zipfile
import os

# 解压日志文件
log_file = '/sdcard/AIAggregator/workflow_logs.txt'
extract_dir = '/sdcard/AIAggregator/workflow_logs/'

# 创建解压目录
if not os.path.exists(extract_dir):
    os.makedirs(extract_dir)

try:
    # 解压ZIP文件
    with zipfile.ZipFile(log_file, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
    print(f"日志文件已解压到: {extract_dir}")
    
    # 列出解压的文件
    for root, dirs, files in os.walk(extract_dir):
        for file in files:
            file_path = os.path.join(root, file)
            print(f"\n文件: {file}")
            
            # 读取文本文件内容
            if file.endswith('.txt'):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # 显示文件内容（前1000字符）
                        print(f"内容预览:\n{content[:1000]}...")
                        
                        # 查找错误信息
                        if 'error' in content.lower() or 'failed' in content.lower():
                            print("⚠️  发现错误信息")
                            # 提取错误相关行
                            lines = content.split('\n')
                            for i, line in enumerate(lines):
                                if 'error' in line.lower() or 'failed' in line.lower():
                                    print(f"  第{i+1}行: {line}")
                except Exception as e:
                    print(f"读取文件时出错: {e}")
            
            print("-" * 50)
            
except Exception as e:
    print(f"解压日志文件时出错: {e}")