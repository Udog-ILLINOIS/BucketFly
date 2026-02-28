import os
import sys
import requests
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

api_key = os.getenv("SUPERMEMORY_API_KEY")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

print("\nTesting /v4/profile POST...")
payload = {
    "containerTag": "inspection_logs",
    "q": "Steps"
}
res = requests.post("https://api.supermemory.ai/v4/profile", headers=headers, json=payload)
print(res.status_code)
if res.status_code == 200:
    data = res.json()
    print("Found memories in profile:", len(data.get('memories', [])))
    if data.get('memories'):
        print(data['memories'][0])
else:
    print(res.text[:200])

print("\nTesting /v4/profile POST without q...")
payload2 = {
    "containerTag": "inspection_logs"
}
res2 = requests.post("https://api.supermemory.ai/v4/profile", headers=headers, json=payload2)
print(res2.status_code)
if res2.status_code == 200:
    data2 = res2.json()
    print("Found memories in profile:", len(data2.get('memories', [])))
else:
    print(res2.text[:200])

