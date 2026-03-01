import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from services.memory_service import memory

try:
    print("Testing get_memories...")
    res = memory.client.memories.get_api_list()
    if hasattr(res, 'data'):
        print(f"Total memories: {len(res.data)}")
        for m in res.data[:3]:
            print(m)
    else:
        print(f"Total memories: {len(res)}")
        for m in list(res)[:3]:
            print(m)
except Exception as e:
    print(f"Error fetching memory list: {e}")
