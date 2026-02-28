import os
import sys
import time
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from services.memory_service import memory

print("--- Testing Supermemory Simple Add ---")

# Generate a unique ID for this test
test_id = f"test_{int(time.time())}"
print(f"Adding memory with custom_id: {test_id}")

try:
    res = memory.client.add(
        content="This is a simple test string to see if Supermemory is working. The quick brown fox jumps over the lazy dog.",
        container_tag="test_container", # Use singular as it might be safer
        custom_id=test_id
    )
    print(f"Add response: {res}")
except Exception as e:
    print(f"Failed to add: {e}")

print("\nWaiting 5 seconds for indexing...")
time.sleep(5)

print("\n--- Testing Supermemory Simple Search ---")
try:
    search_res = memory.client.search.memories(q="quick brown fox")
    
    # Try to safely print results regardless of the object structure
    results = getattr(search_res, 'results', getattr(search_res, 'data', []))
    print(f"Search results count: {len(results)}")
    
    for r in results:
        print(f" - {r}")
except Exception as e:
    print(f"Failed to search: {e}")

print("\n--- Testing Supermemory Profile (Fetch all in container) ---")
try:
    profile_res = memory.client.profile(container_tag="test_container")
    memories = getattr(profile_res, 'memories', [])
    print(f"Profile memories count: {len(memories)}")
    for m in memories:
        print(f" - {m}")
except Exception as e:
    print(f"Failed to fetch profile: {e}")
