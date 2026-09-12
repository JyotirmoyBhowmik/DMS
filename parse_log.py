import re

with open("test_output.log", "r") as f:
    content = f.read()

if "fail" in content:
    lines = content.split('\n')
    for line in lines:
        if line.startswith('# fail '):
            print(line)
