import os
from dotenv import load_dotenv
import supermemory

load_dotenv()
client = supermemory.Supermemory(api_key=os.environ.get("SUPERMEMORY_API_KEY"))

print("Testing search...")
try:
    res = client.memories.search(query="test")
    print(res)
except Exception as e:
    print(e)
