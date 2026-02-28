import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from services.memory_service import memory

print("Fetching history for 1.3 Steps and Handholds...")
res = memory.get_history("1.3 Steps and Handholds")
print(f"Results: {len(res)}")
if res:
    print(res[0])
else:
    print("No results returned.")
    
print("\nFetching history for 2.3 Hydraulic System...")
res = memory.get_history("2.3 Hydraulic System")
print(f"Results: {len(res)}")

# Let's also see if container_tag works better
clean_tag = "1_3_Steps_and_Handholds"
print(f"\nTrying search with just container tag: {clean_tag}...")
try:
    raw = memory.client.search.memories(q="", container_tag=clean_tag)
    print(raw)
except Exception as e:
    print(f"Error: {e}")
