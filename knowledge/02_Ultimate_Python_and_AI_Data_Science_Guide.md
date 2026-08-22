# 02 — Ultimate Python & AI Data Science Guide
### The World's Most Comprehensive Bilingual Python & Data Science Knowledge Base
**For: Custom AI Coding Assistant (RAG System)**
*Language: Bilingual — বাংলা & English | Code: English Only*

---

> **How to Read This Guide / এই গাইডটি কীভাবে পড়বেন:**
> - 🟢 **English** — Technical explanation & code
> - 🔵 **বাংলা** — Mentor-like guidance, concept explanation, friendly advice
> - 🔴 **Bad Code** — What NOT to do
> - 🟩 **Good Code** — The correct way
> - 💡 **Mentor's Tip** — Friendly wisdom at the end of every section

---

# TABLE OF CONTENTS

1. [Python Fundamentals — Deep Dive](#1-python-fundamentals--deep-dive)
2. [OOP in Python — Classes, Inheritance, Magic Methods](#2-oop-in-python--classes-inheritance-magic-methods)
3. [Decorators, Generators & Context Managers](#3-decorators-generators--context-managers)
4. [Data Science Foundations — NumPy & Pandas](#4-data-science-foundations--numpy--pandas)
5. [Machine Learning with scikit-learn](#5-machine-learning-with-scikit-learn)
6. [Deep Learning with PyTorch](#6-deep-learning-with-pytorch)
7. [Python Backend Architectures — FastAPI & Django](#7-python-backend-architectures--fastapi--django)
8. [Python Testing — pytest Masterclass](#8-python-testing--pytest-masterclass)
9. [Python Common Bugs & Exact Fixes](#9-python-common-bugs--exact-fixes)

---

# 1. Python Fundamentals — Deep Dive

## 🟢 English Explanation

Python is an **interpreted**, **high-level**, **dynamically-typed** language. However, it is also **strongly-typed**, meaning the interpreter enforces type safety at runtime without implicit type coercion (unlike JavaScript).

### Core Concept: Mutability & Memory Management

In Python, everything is an **object**. Understanding the difference between mutable and immutable objects is critical for memory management and preventing bugs.

*   **Immutable Types (Pass by Value-like behavior):** `int`, `float`, `str`, `tuple`, `frozenset`. Once created, their value cannot change in memory.
*   **Mutable Types (Pass by Reference behavior):** `list`, `dict`, `set`, custom classes. They can be modified in-place without changing their memory address.

## 🔵 বাংলা ব্যাখ্যা

Python শেখার সময় অনেকেই একটা মস্ত বড় ভুল করে — তারা মনে করে Python-এর variable-গুলো বুঝি অন্য ভাষার মত একটা "পাত্র" বা "বক্স" যেখানে value রাখা হয়। আসলে কিন্তু তা নয়!

Python-এ variable-গুলো হলো শুধুই **Label** বা **Pointer**। যখন তুমি বলো `x = [1, 2, 3]`, তখন মেমরিতে একটা list object তৈরি হয় আর `x` নামের label-টি সেই list-কে point করে।

যখন তুমি একটা mutable object (যেমন list বা dict) পরিবর্তন করো, তখন সব variable যারা একই object point করে ছিল, তারাও পরিবর্তিত দেখায়! এটাই Python-এর সবচেয়ে কমন trap!

---

### ❌ Bad Code — Mutability Reference Trap

```python
# BAD: Mutable object-কে সরাসরি assign করলে reference copy হয়!
old_scores = [90, 85, 77]
new_scores = old_scores  # এটা copy নয়, reference link!

new_scores.append(100)

print(old_scores)  # Output: [90, 85, 77, 100] — ORIGINAL CHANGED! UNEXPECTED!
print(new_scores)  # Output: [90, 85, 77, 100]
```

### ✅ Good Code — Safe Copying & Manipulation

```python
# GOOD: Shallow Copy (ফর simple/one-dimensional structures)
old_scores = [90, 85, 77]
new_scores = old_scores.copy()  # বা new_scores = list(old_scores) অথবা old_scores[:]
new_scores.append(100)

print(old_scores)  # Output: [90, 85, 77] — Unchanged ✓
print(new_scores)  # Output: [90, 85, 77, 100] ✓

# GOOD: Deep Copy (nested arrays/dicts-এর জন্য)
import copy

user_data = {
    "name": "Asif",
    "skills": ["Python", "Pandas"]
}
user_clone = copy.deepcopy(user_data) # Deep copy — safe for nested items
user_clone["skills"].append("PyTorch")

print(user_data["skills"])  # Output: ['Python', 'Pandas'] — Unchanged ✓
print(user_clone["skills"]) # Output: ['Python', 'Pandas', 'PyTorch'] ✓
```

---

💡 **Mentor's Tip:**

> 🟢 **English:** Always remember: **Python is pass-by-assignment.** When passing variables to functions, if the object is mutable (like a list), modifying it inside the function modifies the original caller's data. Always create a copy of the list inside your function if you want to avoid side effects.
>
> 🔵 **বাংলা:** মনে রাখবে: Python-এ default আর্গুমেন্ট হিসেবে কখনো mutable object (যেমন খালি list `[]` বা dict `{}`) ব্যবহার করবে না। এটা করলে মেমরিতে একবারই ওই list-টি তৈরি হয় এবং প্রতিটা ফাংশন কল একই list শেয়ার করে! এটা এড়াতে default হিসেবে `None` ব্যবহার করো (আমরা সেকশন ৯-এ এর সমাধান দেখবো)।

---

# 2. OOP in Python — Classes, Inheritance, Magic Methods

## 🟢 English Explanation

Object-Oriented Programming (OOP) in Python is powerful and highly dynamic. Python uses **Magic Methods** (also called **Dunder Methods**, short for *Double Underline*) to implement operator overloading and built-in behaviors.

### Essential Magic Methods:
*   `__init__`: Constructor method, called when an object is instantiated.
*   `__str__`: Returns a user-friendly string representation (called by `print()`).
*   `__repr__`: Returns an unambiguous string representation for debugging.
*   `__call__`: Allows instances of classes to be called like regular functions.
*   `__enter__` & `__exit__`: Implements the context manager protocol (`with` blocks).

## 🔵 বাংলা ব্যাখ্যা

Python-এর Object Oriented Programming-এর আসল জাদু লুকিয়ে আছে **Magic Methods** বা **Dunder (Double Underline) Methods**-এর মধ্যে।

এগুলো ব্যবহারের মাধ্যমে তুমি তোমার নিজের তৈরি Class-কেও Python-এর built-in টাইপের মত আচরণ করাতে পারো! যেমন, দুটো object-এর মধ্যে যোগ করতে `__add__` ব্যবহার করতে পারো, বা print করার ফরম্যাট ঠিক করতে `__str__` ব্যবহার করতে পারো।

---

### Magic Methods & Operator Overloading Masterclass

```python
class Vector2D:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

    def __str__(self) -> str:
        # User-friendly representation
        return f"Vector({self.x}, {self.y})"

    def __repr__(self) -> str:
        # Developer-friendly (unambiguous, copy-pasteable)
        return f"Vector2D({self.x}, {self.y})"

    def __add__(self, other: 'Vector2D') -> 'Vector2D':
        # Operator Overloading for +
        if not isinstance(other, Vector2D):
            raise TypeError("Can only add Vector2D instances together")
        return Vector2D(self.x + other.x, self.y + other.y)

    def __eq__(self, other: object) -> bool:
        # Equivalence check for ==
        if not isinstance(other, Vector2D):
            return False
        return self.x == other.x and self.y == other.y

    def __call__(self) -> float:
        # Allows class instances to be callable like a function!
        # Returns magnitude of vector
        import math
        return math.sqrt(self.x**2 + self.y**2)

# Usage
v1 = Vector2D(3, 4)
v2 = Vector2D(1, 2)

print(v1)          # Output: Vector(3, 4) (via __str__)
print(repr(v1))    # Output: Vector2D(3, 4) (via __repr__)
v3 = v1 + v2       # Performs Vector vector-addition (via __add__)
print(v3)          # Output: Vector(4, 6)

print(v1 == Vector2D(3, 4)) # Output: True (via __eq__)
print(v1())        # Output: 5.0 (callable via __call__!)
```

---

💡 **Mentor's Tip:**

> 🟢 **English:** In Python, favor `__repr__` over `__str__` if you can only implement one. If `__str__` is missing, Python falls back to `__repr__`, but not vice versa. A good `__repr__` should ideally look like the Python code used to construct the object (e.g., `Vector2D(3, 4)`).
>
> 🔵 **বাংলা:** Magic methods-গুলো তোমার কোডকে পাইথনিক (Pythonic) এবং ক্লিন করে তোলে। তবে প্রয়োজনের অতিরিক্ত operator overloading করবে না — তাতে কোড অনেক জটিল হয়ে যেতে পারে। সাধারণ ডামি প্রিন্টিং ঠিক করতে অন্তত `__repr__` এবং `__str__` প্রতিটা প্রোডাকশন ক্লাসে রাখবেই।

---

# 3. Decorators, Generators & Context Managers

## 🟢 English Explanation

These three advanced features are Python core design paradigms.

### 1. Decorators
A decorator is a function that takes another function as an argument, extends its behavior without modifying it, and returns a new function. They are used for logging, auth, caching, and rate limiting.

### 2. Generators (`yield`)
Generators are iterators that generate values **on-the-fly** instead of storing the entire dataset in memory. They use the `yield` statement and are crucial for handling large data files or memory-restricted operations.

### 3. Context Managers (`with`)
Context managers automate resource allocation and deallocation (like closing database connections or files) safely, even if errors occur inside the block.

## 🔵 বাংলা ব্যাখ্যা

এই ৩টি পাইথন ফিচার তোমাদের জানা থাকলে তোমরা খুব সহজে হাই-পারফরম্যান্স পাইথনিক কোড লিখতে পারবে:

*   **Decorator:** মনে করো তোমার একটা ফাংশন আছে, তুমি সেটার কার্যকারিতা না বদলে তার শুরুতে বা শেষে কিছু অতিরিক্ত কাজ যোগ করতে চাও (যেমন: রান হতে কত সময় লাগলো তা হিসাব করা)। ডেকোরেটর এটা খুব সহজে করে দেয়।
*   **Generator (`yield`):** তোমার যদি ১০ জিবি সাইজের ফাইল থাকে, তুমি যদি পুরো ফাইল একসাথে মেমরিতে লোড করতে চাও তাহলে র্যাম ক্র্যাশ করবে। জেনারেটর একবারে শুধু ১টি করে লাইন মেমরিতে আনে, প্রসেস করে আর ফেলে দেয়!
*   **Context Manager (`with`):** ফাইল ওপেন করে ক্লোজ করতে ভুলে যাওয়া আমাদের কমন ভুল। `with` ব্যবহার করলে পাইথন নিজেই ফাইল বা ডাটাবেজ কানেকশন শেষ হওয়ার পর নিরাপদে ক্লোজ করে দেয়।

---

### ❌ Bad Code — High Memory Usage (Loading whole range)

```python
# BAD: এটি পুরো ১ কোটি সংখ্যা মেমরিতে একসাথে জেনারেট করে লিস্ট তৈরি করে!
# memory spike!
def get_large_range_list():
    result = []
    for i in range(10000000):
        result.append(i * 2)
    return result

# RAM-এর উপর অনেক প্রেশার পড়ে এবং প্রসেস স্লো হয়!
for num in get_large_range_list():
    if num > 100:
        break
```

### ✅ Good Code — Advanced Memory-Efficient Pythonic Implementation

```python
import time
from typing import Callable, Any

# 1. DECORATOR: Measure Execution Time
def time_it(func: Callable) -> Callable:
    def wrapper(*args, **kwargs) -> Any:
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        print(f"⏱️ Function '{func.__name__}' took {end_time - start_time:.6f} seconds to complete.")
        return result
    return wrapper

# 2. GENERATOR: Yield memory-efficient items on-demand
@time_it
def generate_large_range_generator(limit: int):
    # yield ensures memory is only used for ONE item at a time!
    for i in range(limit):
        yield i * 2

# Usage: Runs in micro-seconds because of on-demand execution!
for val in generate_large_range_generator(10000000):
    if val > 100:
        break

# 3. CONTEXT MANAGER: Custom Database Connection Handler
class DatabaseSession:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.connected = False

    def __enter__(self):
        # Resource allocation
        print(f"🔌 Connecting to DB: {self.db_url}")
        self.connected = True
        return self # Object returned for the 'as' clause

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Resource deallocation (always runs even if error occurs!)
        print("🔒 Safely closing database connection...")
        self.connected = False
        if exc_type:
            print(f"⚠️ Exception handled inside context: {exc_val}")
            return True # Exception is suppressed, program continues
        return False

# Usage
with DatabaseSession("postgresql://localhost:5432/ai_db") as db:
    print("💾 Querying databases and running analysis...")
    # raise ValueError("Query timeout error!") # If this happens, connection STILL closes safely!
```

---

💡 **Mentor's Tip:**

> 🟢 **English:** Whenever you are writing loops that read databases, large CSVs, or log files, **never return lists.** Always use `yield` to return a generator. It's the difference between a system using 8GB of RAM and one using only 10MB.
>
> 🔵 **বাংলা:** জেনারেটর আর ডেকোরেটর—এই দুটি পাইথন ডেভেলপারদের প্রধান হাতিয়ার। জেনারেটর লেখার সময় মনে রাখবে `return` এর বদলে `yield` ব্যবহার করা হয়। আর ডেকোরেটর লেখার সময় ভেতরের `wrapper` ফাংশনের আর্গুমেন্টে সব সময় `*args, **kwargs` রাখবে যাতে যেকোনো আর্গুমেন্ট বিশিষ্ট ফাংশনকে সে ডেকোরেট করতে পারে।

---

# 4. Data Science Foundations — NumPy & Pandas

## 🟢 English Explanation

Data Science relies on vectorization and efficient block arrays in memory.
*   **NumPy (`np.ndarray`):** Written in C, it uses contiguous memory blocks allowing **vectorized operations** (avoiding slower Python `for` loops).
*   **Pandas (`pd.DataFrame` & `pd.Series`):** A wrapper around NumPy. It provides relational structures, missing data handling, and optimized aggregation functions.

### Vectorization Principle:
Always avoid explicit python loops over data. Instead, apply operations directly to arrays (Vectorization).

## 🔵 বাংলা ব্যাখ্যা

Data Science বা Machine Learning-এ কোড লেখার সময় একটি চরম সত্য মনে রাখবে: **পাইথনের `for` লুপ ডাটা প্রসেসিংয়ের জন্য অত্যন্ত ধীরগতির!**

তাই আমরা **NumPy** এবং **Pandas** ব্যবহার করি। NumPy-এর সব অ্যারে মেমরিতে পাশাপাশি (contiguous) ব্লকে থাকে এবং এর ভেতরে অপ্টিমাইজড **C কোড** চলে। 

যখন তুমি NumPy অ্যারেতে `arr * 2` করো, পাইথন লুপ না চালিয়ে C লেভেলে পুরো অ্যারেতে একসাথে গুণ করে ফেলে! এটাকে **Vectorization** বলে।

---

### ❌ Bad Code — Slow Manual Loop over DataFrame

```python
# BAD: DataFrame-এর প্রতিটা লাইনে manual loop চালানো চরম স্লো!
import pandas as pd
import numpy as np

df = pd.DataFrame({
    'price': np.random.uniform(10, 1000, 100000),
    'discount': np.random.uniform(0.05, 0.25, 100000)
})

# 🐌 Manual loop via iterrows — Takes seconds to run!
df['final_price'] = 0.0
for index, row in df.iterrows():
    df.at[index, 'final_price'] = row['price'] * (1 - row['discount'])
```

### ✅ Good Code — Highly Optimized Vectorized Vector Ops

```python
# GOOD: Vectorized Operation — Runs instantly! (100x to 1000x faster)
import pandas as pd
import numpy as np

df = pd.DataFrame({
    'price': np.random.uniform(10, 1000, 100000),
    'discount': np.random.uniform(0.05, 0.25, 100000)
})

# ⚡ Vectorized calculation — executes directly in optimized C!
df['final_price'] = df['price'] * (1 - df['discount'])

# GOOD: Conditional evaluations using np.select or np.where
# Classify price tiers quickly without slow apply() functions
conditions = [
    (df['final_price'] < 100),
    (df['final_price'] >= 100) & (df['final_price'] < 500),
    (df['final_price'] >= 500)
]
choices = ['Low', 'Medium', 'High']

df['price_tier'] = np.select(conditions, choices, default='Medium')

# Quick exploratory analysis aggregations
summary = df.groupby('price_tier')['final_price'].agg(['mean', 'count', 'std'])
print(summary)
```

---

💡 **Mentor's Tip:**

> 🟢 **English:** In Pandas, if you cannot find a vectorized operator, use `.apply()` only as a last resort, but prefer `np.select` or `np.where` for conditionals, and use the `.values` property to drop down to pure NumPy arrays when raw speed is your ultimate bottleneck.
>
> 🔵 **বাংলা:** Pandas কোডে যখনই দেখবে তোমার লুপ চালানো লাগছে, তখনই বুঝবে তোমার কোডে বড় ভুল হচ্ছে। `iterrows()` বা `itertuples()` ব্যবহার করা একদমই পরিহার করো। সব সময় সরাসরি কলাম অপারেশন করো (যেমন: `df['A'] + df['B']`), এটি ব্যাকএন্ডে অপ্টিমাইজড ভেক্টরাইজড অ্যালগরিদম ব্যবহার করে।

---

# 5. Machine Learning with scikit-learn

## 🟢 English Explanation

scikit-learn is the standard library for classical Machine Learning (Regression, Classification, Clustering). 
The core design pattern of scikit-learn is the **`Estimator` API** (`fit`, `transform`, `predict`).

### Pipeline Pattern
To prevent **Data Leakage** (when test set statistics accidentally leak into the training process during preprocessing), you must encapsulate all scaler, imputation, and model training steps inside a **`Pipeline`**.

## 🔵 বাংলা ব্যাখ্যা

Machine Learning মডেল বানানোর সময় সবচেয়ে জটিল এবং সাধারণ ভুলটি হলো **Data Leakage**।

সহজ কথায়: তুমি যদি মডেল ট্রেন করার আগেই পুরো ডাটা একসাথে স্কেলিং (Normalization) করো, তাহলে টেস্ট সেটের ইনফরমেশন ট্রেনিং সেটে চলে যায়। এর ফলে তোমার মডেলে ট্রেনিংয়ের সময় অসামান্য একুরেসি দেখাবে, কিন্তু আসল রিয়েল-ওয়ার্ল্ড ডাটা দিলে মডেল ফেইল করবে!

এর একমাত্র সমাধান হলো scikit-learn-এর **Pipeline** ব্যবহার করা। এটি তোমার ডাটা প্রসেসিং এবং মডেল ট্রেনিং ধাপগুলোকে একটি একক এবং নিরাপদ ফ্লো-তে লক করে ফেলে।

---

### ❌ Bad Code — Leaked Train/Test Split (Manual Scaling Trap)

```python
# BAD: Train-Test Split করার আগেই পুরো ডাটার উপর scaling চালালে leakage হয়!
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
import numpy as np

# Mock dataset
X = np.random.randn(1000, 10)
y = np.random.randint(0, 2, 1000)

# SCALED BEFORE SPLIT — DATA LEAKAGE INITIATED!
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X) # Statistics of test data leak to training!

X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2)
model = LogisticRegression()
model.fit(X_train, y_train)
```

### ✅ Good Code — Leak-Free Machine Learning Pipeline

```python
# GOOD: Pipeline prevents any data leakage and encapsulates the workflow!
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import pandas as pd
import numpy as np

# Create clean mock DataFrame with missing values
raw_data = pd.DataFrame(np.random.randn(1000, 4), columns=['feat1', 'feat2', 'feat3', 'feat4'])
raw_data['category'] = np.random.choice(['A', 'B', 'C'], size=1000)
raw_data['target'] = np.random.randint(0, 2, size=1000)
# Inject random missing values (NaN)
raw_data.loc[raw_data.sample(frac=0.05).index, 'feat1'] = np.nan

# Features and target split
X = raw_data.drop('target', axis=1)
y = raw_data['target']

# Split data FIRST before any pre-processing!
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Set up transformers
numeric_features = ['feat1', 'feat2', 'feat3', 'feat4']
numeric_transformer = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='median')), # Handle missing values safely
    ('scaler', StandardScaler())                  # Scale values safely
])

# Column preprocessor
preprocessor = ColumnTransformer(
    transformers=[
        ('num', numeric_transformer, numeric_features)
    ])

# Complete model training pipeline
pipeline = Pipeline(steps=[
    ('preprocessor', preprocessor),
    ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))
])

# Fit ONLY on training data — test data statistics are completely isolated ✓
pipeline.fit(X_train, y_train)

# Predict safely on test data
predictions = pipeline.predict(X_test)

print(f"Accuracy Score: {accuracy_score(y_test, predictions):.4f}")
print(classification_report(y_test, predictions))
```

---

💡 **Mentor's Tip:**

> 🟢 **English:** Always split your datasets BEFORE any data imputation or scaling. Always use scikit-learn's `Pipeline` to chain preprocessing and model training. It makes your code production-ready and protects against severe deployment-time accuracy drops caused by data leaks.
>
> 🔵 **বাংলা:** পাইপলাইন (Pipeline) ব্যবহার করার আরেকটি বড় সুবিধা হলো, পরবর্তীতে মডেলটি সার্ভারে ডিপ্লয় করা অনেক সহজ হয়। সিঙ্গেল ফাইল হিসেবে জবলিব (`joblib.dump(pipeline, "model.pkl")`) দিয়ে সেভ করে সরাসরি এপিআই সার্ভারে লোড করে প্রোডাকশনে পাঠাতে পারো। ডাটা ম্যানুয়ালি প্রসেস করার দরকারই পড়ে না!

---

# 6. Deep Learning with PyTorch

## 🟢 English Explanation

**PyTorch** is the leading library for Deep Learning and Neural Networks. 
Its core design is centered around **Tensors** (similar to NumPy arrays but can run on GPU via CUDA) and **Dynamic Computational Graphs** (Autograd).

### Core Training Loop Paradigm:
1.  **Forward Pass:** Pass input data through model layers to generate predictions.
2.  **Calculate Loss:** Measure error using a loss function (e.g., Cross-Entropy, MSE).
3.  **Backward Pass (Backpropagation):** Compute gradients via `.backward()`.
4.  **Optimizer Step:** Adjust model weights to minimize error via `.step()`.

## 🔵 বাংলা ব্যাখ্যা

Deep Learning জগতে পাইথনের সবচেয়ে জনপ্রিয় লাইব্রেরি হলো **PyTorch**। PyTorch-এর মূল চালিকাশক্তি হলো **Tensor**—যা মূলত ম্যাথমেটিক্যাল ম্যাট্রিক্স। কিন্তু সাধারণ অ্যারের চেয়ে এর ১টি বিশাল ক্ষমতা আছে: এটি **GPU** (গ্রাফিক্স কার্ড) ব্যবহার করে সাধারণ সিপিইউ থেকে ১০০ গুণ বেশি স্পিডে হিসাব করতে পারে!

PyTorch-এ নিউরাল নেটওয়ার্ক ট্রেন করার ৪টি মূল স্টেপ মনে রাখবে:
1.  **Forward Pass:** ইনপুট মডেল-এ দিয়ে আউটপুট বের করা।
2.  **Loss Calculation:** আউটপুট আসল উত্তরের কত কাছাকাছি তা মাপা (Loss)।
3.  **Backpropagation:** গ্রেডিয়েন্ট ক্যালকুলেট করে দেখা কোন ওজনের কারণে ভুল কত বেশি হয়েছে (`loss.backward()`)।
4.  **Optimizer Update:** মডেলের প্যারামিটার বা ওজনগুলো একটু টিউন করা যাতে পরের বার ভুল কম হয় (`optimizer.step()`)।

---

### Production-Ready PyTorch Neural Network Training Flow

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

# 1. Check if GPU (CUDA/MPS) is available for high-speed training
device = torch.device(
    "cuda" if torch.cuda.is_available() 
    else "mps" if torch.backends.mps.is_available() 
    else "cpu"
)
print(f"💻 Using processing device: {device}")

# 2. Define standard PyTorch Feedforward Neural Network Architecture
class DeepClassifier(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int, output_dim: int):
        super(DeepClassifier, self).__init__()
        # Input to Hidden Layer
        self.layer1 = nn.Linear(input_dim, hidden_dim)
        self.relu = nn.ReLU()
        # Hidden to Output Layer (Binary classification)
        self.layer2 = nn.Linear(hidden_dim, output_dim)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.layer1(x)
        out = self.relu(out)
        out = self.layer2(out)
        out = self.sigmoid(out)
        return out

# 3. Prepare Mock Dataset & Loaders
X_data = torch.randn(2000, 10)  # 2000 samples, 10 features
y_data = torch.randint(0, 2, (2000, 1)).float()

dataset = TensorDataset(X_data, y_data)
# DataLoader handles batching, shuffling and memory pinning automatically!
train_loader = DataLoader(dataset, batch_size=64, shuffle=True)

# 4. Initialize model, optimizer, and loss function
model = DeepClassifier(input_dim=10, hidden_dim=32, output_dim=1).to(device)
criterion = nn.BCELoss() # Binary Cross Entropy Loss
optimizer = optim.Adam(model.parameters(), lr=0.005) # Adam Optimizer

# 5. Core Neural Network Training Loop
model.train() # Set model to training mode (enables dropout/batchnorm)
epochs = 5

for epoch in range(epochs):
    epoch_loss = 0.0
    for inputs, labels in train_loader:
        # Move batches to the processing device (GPU or CPU)
        inputs, labels = inputs.to(device), labels.to(device)

        # Step A: Clear previous gradients (crucial!)
        optimizer.zero_grad()

        # Step B: Forward Pass
        outputs = model(inputs)

        # Step C: Compute Loss
        loss = criterion(outputs, labels)

        # Step D: Backward Pass (Autograd calculates gradients)
        loss.backward()

        # Step E: Update Model Weights
        optimizer.step()

        epoch_loss += loss.item() * inputs.size(0)

    avg_loss = epoch_loss / len(train_loader.dataset)
    print(f"📈 Epoch {epoch+1}/{epochs} | Average Training Loss: {avg_loss:.4f}")
```

---

💡 **Mentor's Tip:**

> 🟢 **English:** The most common beginner bug in PyTorch is forgetting to call `optimizer.zero_grad()` at the start of each batch loop. If you omit it, PyTorch accumulates gradients over iterations, which completely ruins gradient descent and halts learning.
>
> 🔵 **বাংলা:** পাইটর্চে প্রতি ব্যাচ ট্রেনিংয়ের শুরুতে `optimizer.zero_grad()` কল করতে কখনই ভুলবে না। পাইটর্চ বাই-ডিফল্ট আগের গ্রেডিয়েন্টগুলো জমা করে রাখে (accumulate করে)। যদি শূন্য না করো, তাহলে ভুল ক্যালকুলেশন হয়ে তোমার মডেল কখনও ট্রেন হবে না।

---

# 7. Python Backend Architectures — FastAPI & Django

## 🟢 English Explanation

For web APIs and backend systems, Python offers two excellent paths:
*   **FastAPI:** Modern, asynchronous, incredibly fast (comparable to Go and Node.js) API framework based on **Pydantic** for automated data validation and OpenAPI generation.
*   **Django:** A "batteries-included" full-stack framework with built-in ORM, admin dashboard, auth system, and migrations. Best for monolithic apps with standard structures.

## 🔵 বাংলা ব্যাখ্যা

পাইথনে ব্যাকএন্ড ডেভেলপমেন্টের জন্য দুটি সেরা অপশন আছে:

*   **FastAPI:** এটি অত্যন্ত আধুনিক এবং এটি পাইথনের **Asynchronous (async/await)** সাপোর্ট ব্যবহার করে। এটি অসম্ভব ফাস্ট এবং এর সাথে অটোমেটিক **Swagger UI (documentation)** ও **Pydantic validation** ফ্রি পাওয়া যায়। ছোট-মাঝারি সার্ভিস বা মাইক্রোসার্ভিসের জন্য এটি বেস্ট!
*   **Django:** এটি একটি শক্তিশালী জায়ান্ট! এর ওআরএম (ORM), এডমিন প্যানেল, এবং সিকিউরিটি সিস্টেম সবকিছু ডিক্লেয়ার করাই থাকে। বড় প্রজেক্ট বা রিলেশনাল ডাটাবেজ নির্ভর মনোলিথ অ্যাপের জন্য জ্যাঙ্গো অতুলনীয়।

---

### FastAPI Production Pattern with Pydantic Validations

```python
# FastAPI App — Highly scalable, async, fully documented!
from fastapi import FastAPI, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
import uvicorn

app = FastAPI(
    title="AI Knowledge Base API",
    description="Production-grade API endpoints for RAG Systems",
    version="1.0.0"
)

# Pydantic Schemas for automated input validation (and Swagger specs)
class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100, example="React Hooks Guide")
    category: str = Field(..., example="Frontend")
    content: str = Field(..., min_length=10, example="Complete guide to useEffect hook...")
    priority: Optional[int] = Field(default=1, ge=1, le=5)

class DocumentResponse(BaseModel):
    id: int
    title: str
    category: str
    content: str
    priority: int

# Mock Database Store
db_store: List[DocumentResponse] = []
id_counter = 1

# Dependency Injection example (simple mock authentication)
async def verify_api_key(api_key: str = "pcsk_62DgbU_t54"):
    if api_key != "pcsk_62DgbU_t54":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid security token provided."
        )
    return api_key

# POST Endpoint: Securely save document and return validated response
@app.post(
    "/documents", 
    response_model=DocumentResponse, 
    status_code=status.HTTP_201_CREATED,
    summary="Add a new documentation file"
)
async def create_document(doc: DocumentCreate, token: str = Depends(verify_api_key)):
    global id_counter
    new_doc = DocumentResponse(
        id=id_counter,
        title=doc.title,
        category=doc.category,
        content=doc.content,
        priority=doc.priority or 1
    )
    db_store.append(new_doc)
    id_counter += 1
    return new_doc

# GET Endpoint: Retrieve all documents
@app.get(
    "/documents", 
    response_model=List[DocumentResponse],
    summary="Fetch all stored files"
)
async def list_documents():
    return db_store

# Command to run: uvicorn main:app --reload
```

---

💡 **Mentor's Tip:**

> 🟢 **English:** In FastAPI, always use `async def` for API handlers that perform network requests, file reading, or database queries. This releases Python's event loop to handle thousands of concurrent requests while waiting for I/O operations, ensuring high concurrency throughput.
>
> 🔵 **বাংলা:** FastAPI-এর সবচেয়ে দারুণ ফিচার হলো এটি অটোমেটিক Swagger ডকুমেন্টেশন পেজ জেনারেট করে দেয়! অ্যাপ রান করার পর ব্রাউজারে `http://localhost:8000/docs` লিংকে গেলে তুমি এপিআই টেস্ট করার ইন্টারফেস পেয়ে যাবে। কোন পোস্টম্যানে যাওয়ারও ঝামেলা নেই!

---

# 8. Python Testing — pytest Masterclass

## 🟢 English Explanation

Testing Python code requires a robust tool. **`pytest`** is the standard framework for writing scalable tests.

### Key pytest Concepts:
1.  **Fixtures (`@pytest.fixture`):** Reusable helper functions that set up a state, mock database sessions, or prepare input data before tests run, and tear them down afterward.
2.  **Parametrization (`@pytest.mark.parametrize`):** Writing a single test function but testing it across multiple inputs and expected outcomes (DRY).
3.  **Mocking (`pytest-mock`):** Replacing slower or third-party components (like active Stripe calls or OpenAI calls) with fake return objects.

## 🔵 বাংলা ব্যাখ্যা

অনেকেই কোড লিখে টেস্ট করতে চায় না, কিন্তু মনে রাখবে: **যে কোডের টেস্ট নাই, সেই কোড প্রোডাকশনে যেকোনো সময় ক্র্যাশ করতে পারে!** পাইথনে টেস্ট করার জন্য স্ট্যান্ডার্ড ফ্রেমওয়ার্ক হলো **pytest**।

pytest-এর দুটি স্পেশাল ফিচার শিখে নাও:
*   **Fixture:** এটি হলো একটি সেটআপ ফাংশন। টেস্ট রান করার আগে ডাটাবেজ রেডি করা বা ফেক ইউজার তৈরি করা এর কাজ।
*   **Parametrize:** মনে করো একটা ফাংশন ১০ রকম ডাটা দিয়ে টেস্ট করতে হবে। ১০টি আলাদা টেস্ট না লিখে ১টি টেস্টেই ১০টি ডাটা ইনপুট করিয়ে দেওয়া যায় প্যারামেট্রাইজেশন দিয়ে।

---

### Clean Test-Driven pytest Implementation

```python
# To run this: pip install pytest
import pytest
from typing import Dict, List

# Core system code to test
class IngestionPipeline:
    def __init__(self):
        self.raw_documents: List[str] = []

    def clean_text(self, text: str) -> str:
        if not isinstance(text, str):
            raise TypeError("Only string text can be processed")
        return text.strip().lower()

    def add_document(self, doc_text: str):
        cleaned = self.clean_text(doc_text)
        if len(cleaned) < 5:
            raise ValueError("Document is too short")
        self.raw_documents.append(cleaned)


# === PYTEST TESTS ===

# 1. FIXTURE: Prepare clean pipeline instance for every test
@pytest.fixture
def pipeline():
    return IngestionPipeline()


# 2. PARAMETRIZE: Test clean_text across multiple distinct inputs
@pytest.mark.parametrize(
    "input_text, expected_output",
    [
        ("  Hello World  ", "hello world"),
        ("PyThOn  \n", "python"),
        ("AI   DATA  SCIENCE", "ai   data  science"),
    ]
)
def test_clean_text_variations(pipeline, input_text, expected_output):
    assert pipeline.clean_text(input_text) == expected_output


# 3. Test Success Path
def test_add_document_success(pipeline):
    pipeline.add_document("   This is a highly valuable document.  ")
    assert len(pipeline.raw_documents) == 1
    assert pipeline.raw_documents[0] == "this is a highly valuable document."


# 4. Test Exception Errors
def test_add_document_too_short_raises_error(pipeline):
    # Expecting ValueError to be thrown
    with pytest.raises(ValueError, match="Document is too short"):
        pipeline.add_document("abc")


def test_clean_text_invalid_type_raises_error(pipeline):
    # Expecting TypeError to be thrown
    with pytest.raises(TypeError, match="Only string text can be processed"):
        pipeline.clean_text(12345) # Passing a number instead of string
```

---

💡 **Mentor's Tip:**

> 🟢 **English:** Write modular tests. Never make one big test that covers your entire application. Keep each test focused on exactly one scenario. Mock out external internet dependencies (like active APIs) so that your test suite runs instantly.
>
> 🔵 **বাংলা:** পাইটেস্টে টেস্ট ফাইল এবং টেস্ট ফাংশন দুটির নামই সব সময় `test_` দিয়ে শুরু হতে হবে (যেমন: `test_api.py` এবং `def test_login()`)। অন্যথায় pytest তোমার ফাইলটিকে অটোমেটিক্যালি খুজে পাবে না।

---

# 9. Python Common Bugs & Exact Fixes

## 🔵 বাংলা ভূমিকা

এই সেকশনে পাইথন ডেভেলপারদের করা সবচেয়ে ৩টি মারাত্মক ভুলের ব্যাখ্যা ও তার তাত্ক্ষণিক সমাধান দেওয়া হলো। এগুলো এড়িয়ে চললে তুমি পাইথন রাইটিংয়ে অনেক গুণ প্রোফেশনাল হয়ে যাবে।

---

### Bug #1: Mutable Default Arguments Trap

```python
# ❌ CAUSE: Python-এ default arguments একবারই এভালুয়েট হয় মডিউল লোড টাইমে।
# খালি list '[]' ব্যবহার করায় প্রতিবার কল করার সময় আগের list-ই আপডেট হয়!
def add_to_team(member: str, team: list = []):
    team.append(member)
    return team

print(add_to_team("Sohan")) # Output: ['Sohan']
print(add_to_team("Mitu"))  # Output: ['Sohan', 'Mitu'] — BUG! Mitu-এর টিমে Sohan চলে এসেছে!
```

```python
# ✅ FIX: Use None as default value and initialize list inside function safely!
def add_to_team(member: str, team: list = None):
    if team is None:
        team = [] # New empty list generated on every call ✓
    team.append(member)
    return team

print(add_to_team("Sohan")) # Output: ['Sohan'] ✓
print(add_to_team("Mitu"))  # Output: ['Mitu'] ✓ — FIXED! Independent lists!
```

---

### Bug #2: `is` vs `==` Confusion

```python
# ❌ CAUSE: '==' ভ্যালু কম্পেয়ার করে, কিন্তু 'is' কম্পেয়ার করে অবজেক্ট দুটির মেমরি অ্যাড্রেস (Identity)।
# Python ছোট integers (-5 থেকে 256) ক্যাশ করে রাখে, কিন্তু বড় সংখ্যা ক্যাশ করে না।
a = 300
b = 300

print(a == b) # Output: True — Values are equal
print(a is b) # Output: False — BUG! references are different because they are not cached!
```

```python
# ✅ FIX: Use '==' for value equivalence, use 'is' strictly for singleton identity check (like None)
user_active = None

if user_active is None: # Correct use of 'is'
    print("User is inactive")

score_a = 500
score_b = 500
if score_a == score_b: # Correct use of '==' for comparing values
    print("Scores match!")
```

---

### Bug #3: Modifying a List While Iterating Over It

```python
# ❌ CAUSE: লুপ চলার সময় লিস্ট থেকে আইটেম রিমুভ করলে লিস্টের ইনডেক্স স্থানচ্যুত হয়।
# এর ফলে পাইথন কিছু আইটেম স্কিপ করে ফেলে!
numbers = [1, 2, 3, 4, 5, 6]

for num in numbers:
    if num % 2 == 0:
        numbers.remove(num) # Modifying list in-place during active loop

print(numbers) # Output: [1, 3, 5] (Wait, we got lucky here, but what if there are consecutive numbers?)

items = [1, 2, 2, 3]
for item in items:
    if item == 2:
        items.remove(item)
print(items) # Output: [1, 2, 3] — BUG! The second '2' was skipped because of index shift!
```

```python
# ✅ FIX 1: Iterate over a copy of the list, or use clean List Comprehension (Preferred!)
items = [1, 2, 2, 3]

# List comprehension generates a clean new filtered list safely!
filtered_items = [item for item in items if item != 2]
print(filtered_items) # Output: [1, 3] ✓ - FIXED!

# Fix 2: Loop over a shallow copy
for item in items[:]: # [:] creates a shallow copy, safe to modify original items list
    if item == 2:
        items.remove(item)
```

---

💡 **Final Mentor's Tip:**

> 🟢 **English:** The mark of a true Senior Python Developer is writing code that reads like English but is computationally optimized. Minimize state mutability, encapsulate preprocessing steps, write asynchronous FastAPI endpoints for high scale, and cover your logical paths with pytest cases. Happy coding!
>
> 🔵 **বাংলা:** পাইথনের আসল সৌন্দর্য হলো এর সরলতা। কোড সবসময় পাইথনিক করার চেষ্টা করবে — অর্থাৎ, লিস্ট কম্প্রিহেনশন, জেনারেটর এবং বিল্ট-ইন মেথডগুলো ব্যবহার করে ছোট অথচ দক্ষ কোড লিখবে। টেস্ট করার অভ্যাস গড়ে তোলো আর মেমরি নিয়ে সচেতন থেকো। তোমার পাইথন লার্নিং জার্নির জন্য অনেক অনেক শুভকামনা! 🚀

---

## 📚 Reference Table — Quick Lookup

| Topic | Key Concept | Common Mistake | Quick Fix |
|-------|-------------|----------------|-----------|
| Arguments | Default lists are cached | `def fn(x=[])` | Use `def fn(x=None)` and dynamic init |
| Identity | `is` is for memory address | `x is 300` | Use `==` for comparing values |
| Iteration | Mutating index breaks loops | `list.remove(x)` in loop | Use List Comprehension: `[x for x in list if condition]` |
| Memory | Generators save RAM | Loading huge CSV into list | Use `yield` instead of returning lists |
| Data Leak | Split train/test first | Scaling before split | Wrap transformers in scikit-learn Pipeline |
| PyTorch | Clear previous gradients | Missing `optimizer.zero_grad()` | Always clear gradients before batch forward pass |

---

*📄 File: `02_Ultimate_Python_and_AI_Data_Science_Guide.md`*
*🔄 Version: 1.0.0 | Updated: 2026*
*🌐 Languages: English + বাংলা*
*🎯 For: RAG System — Custom AI Coding Assistant*
