import re
with open('temp_html.txt', 'r', encoding='utf-16') as f:
    text = f.read()
matches = re.findall(r'class="([^"]+)"', text)
print(list(set(matches))[:50])
