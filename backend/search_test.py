import os
from dotenv import load_dotenv
import inspect

load_dotenv()
try:
    import supermemory
    client = supermemory.Supermemory(api_key=os.environ.get("SUPERMEMORY_API_KEY"))
    
    print("=== client.add ===")
    print(inspect.signature(client.add))
    
    print("=== client.search.memories ===")
    try:
        print(inspect.signature(client.search.memories))
    except Exception as e:
        print(e)
except Exception as e:
    print(e)
