# Python Debugging, Async Pitfalls & Runtime Errors Guide

This document details critical debugging patterns, asynchronous execution traps, and memory management issues in Python applications, including clear side-by-side **Bad Code vs. Good Code** scenarios.

---

## 1. Mutable Default Arguments (The Static Accumulation Bug)

### The Pitfall: Default Parameters evaluate exactly ONCE at Module Load Time
In Python, default arguments are evaluated only once when the function is first loaded by the interpreter. If you use a mutable object (like a list `[]` or a dictionary `{}`) as a default argument, all subsequent calls to that function share the exact same list/dict reference in memory. Modifying it accumulates mutations across unrelated invocations.

### Bad Code (Anti-Pattern)
```python
# ❌ Bug: The list parameter default is shared across every call.
def append_to_user_history(action, history=[]):
    history.append(action)
    return history

session_one = append_to_user_history("login")
print(session_one)  # Output: ['login']

session_two = append_to_user_history("view_settings")
# ❌ Bug: Output unexpected: Accumulates session_one context!
print(session_two)  # Output: ['login', 'view_settings']
```

### Good Code (Best Practice)
```python
# ✅ Solution: Standardize default to None and initialize inside scope
def append_to_user_history(action, history=None):
    if history is None:
        history = []  # Created dynamically in local execution memory
    history.append(action)
    return history

session_one = append_to_user_history("login")
print(session_one)  # Output: ['login']

session_two = append_to_user_history("view_settings")
print(session_two)  # Output: ['view_settings'] (Clean & Isolated!)
```

### Step-by-Step Logic Solution
1. **Never use `[]`, `{}`, or `set()` as parameters**: Always set mutable default arguments to `None`.
2. **Local Initialization**: Check if the parameter is `None` on the first line of the function and dynamically instantiate a clean collection (`list`, `dict`, etc.) inside the local scope if necessary.

---

## 2. Asynchronous Async/Await Pitfalls

### The Pitfall: Synchronous Blocking Operations inside Async Routines
Using synchronous blocking operations (like standard `time.sleep()`, standard `requests.get()`, or expensive synchronous file system operations) inside an `async def` function stalls the single-threaded event loop completely. Other concurrent tasks scheduled on the loop will pause, completely negating async performance benefits.

### Bad Code (Anti-Pattern)
```python
import asyncio
import time
import requests

async def process_developer_task(task_id):
    print(f"Starting task {task_id}")
    # ❌ Bug 1: time.sleep() blocking call halts the whole asyncio event loop!
    time.sleep(2) 
    
    # ❌ Bug 2: requests.get() blocks the loop synchronously until network responds
    response = requests.get("https://api.github.com")
    
    print(f"Completed task {task_id} with status {response.status_code}")

async def main():
    # Attempting concurrent processing
    await asyncio.gather(
        process_developer_task(1),
        process_developer_task(2)
    ) # Takes ~4-6 seconds sequentially instead of running concurrently!
```

### Good Code (Best Practice)
```python
import asyncio
import httpx  # Non-blocking async network client

async def process_developer_task(task_id):
    print(f"Starting task {task_id}")
    # ✅ Solution 1: Use non-blocking asyncio.sleep to yield event loop control
    await asyncio.sleep(2)
    
    # ✅ Solution 2: Use async-compliant client (httpx or aiohttp)
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.github.com")
    
    print(f"Completed task {task_id} with status {response.status_code}")

async def main():
    # Executes fully concurrently on the event loop
    await asyncio.gather(
        process_developer_task(1),
        process_developer_task(2)
    ) # Runs smoothly in parallel, completing in ~2 seconds total!
```

### Step-by-Step Logic Solution
1. **Never use standard sleep or requests in async loops**: Swap `time.sleep` with `await asyncio.sleep`.
2. **Use async-compatible network libraries**: Replace traditional synchronous drivers/libraries (e.g. `requests`) with high-performance asynchronous alternatives (e.g. `httpx`, `aiohttp`, `tortoise-orm`).
3. **Execute legacy blocking code in executors**: If forced to run legacy blocking tasks, execute them inside a separate thread pool using:
   `await asyncio.get_running_loop().run_in_executor(None, blocking_func)`

---

## 3. Common Runtime Exceptions & KeyError Faults

### KeyError Fixes: Accessing Unsafely Structured Dict Keys
Accessing keys using direct bracket notations `dict[key]` throws an unhandled `KeyError` exception if the target key is missing. This often crashes backend API routers.

### Bad Code (Anti-Pattern)
```python
def extract_metadata(user_profile):
    # ❌ Bug: Any missing key will crash the script instantly with KeyError
    age = user_profile["preferences"]["age"]
    theme = user_profile["settings"]["theme"]
    return age, theme
```

### Good Code (Best Practice)
```python
def extract_metadata(user_profile):
    # ✅ Solution 1: Safely traverse with .get() or use dict default fallback
    preferences = user_profile.get("preferences", {})
    age = preferences.get("age", 25) # Safe fallback value
    
    # ✅ Solution 2: Catch KeyErrors in a structured block
    try:
        theme = user_profile["settings"]["theme"]
    except KeyError:
        theme = "light" # Secure default choice
        
    return age, theme
```

---

## 4. Memory Leakage and garbage collection traps

* **Reference Cycles**: Beware of object reference loops (e.g., parent references child, and child references parent). While Python's Garbage Collector handles circular references, it can cause delayed cleanup. Use `weakref` for inverse relations.
* **Large Generators**: Do not parse massive files using `.read()`. Stream files line-by-line using generators to keep the memory footprint constant:
  ```python
  # ✅ Stream large logs without bloating server RAM
  def stream_large_log(file_path):
      with open(file_path, "r") as f:
          for line in f:
              yield line
  ```
