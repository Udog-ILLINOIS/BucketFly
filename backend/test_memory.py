import sys
import os

# Create dummy api key for test
os.environ["SUPERMEMORY_API_KEY"] = "test"

# Make sure backend package is discoverable
sys.path.insert(0, os.path.abspath('.'))

try:
    from services.memory_service import memory
    print("Memory service loaded successfully")
except Exception as e:
    print(f"Error loading memory service: {e}")
