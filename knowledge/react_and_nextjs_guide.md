# React and Next.js Debugging & Development Guide

This guide details common engineering pitfalls in modern React and Next.js (App Router) applications, providing direct root-cause analyses, robust solutions, and side-by-side **Bad Code vs. Good Code** comparisons.

---

## 1. Asynchronous State Updates & Stale Closures

### The Bug: State Updates are Batch-Processed and Asynchronous
In React, calling a state setter (e.g., `setCount`) does not immediately mutate the state variable in the current execution block. Instead, it schedules a state transition. Attempting to read the state variable immediately after setting it yields the old (stale) value. 

Additionally, if a callback or effect captures a state variable from a previous render cycle without a correct dependency array, it creates a **stale closure**, continuing to reference the outdated value.

### Bad Code (Anti-Pattern)
```tsx
import React, { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);

  const handleIncrementMultiple = () => {
    // ❌ Bug: Every setter calls count (0) + 1. Count ends up as 1 instead of 3.
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);
  };

  const handleAlertValue = () => {
    setCount(count + 1);
    // ❌ Bug: Alert displays the old state value because setCount is asynchronous
    alert(`Current Count: ${count}`); 
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={handleIncrementMultiple}>Add 3</button>
      <button onClick={handleAlertValue}>Increment & Alert</button>
    </div>
  );
}
```

### Good Code (Best Practice)
```tsx
import React, { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);

  const handleIncrementMultiple = () => {
    // ✅ Solution: Use functional updates. Each call receives the most up-to-date queued state.
    setCount(prev => prev + 1);
    setCount(prev => prev + 1);
    setCount(prev => prev + 1);
  };

  const handleAlertValue = () => {
    // ✅ Solution: Calculate the next state value explicitly or execute inside a temporary variable
    const nextCount = count + 1;
    setCount(nextCount);
    alert(`Current Count: ${nextCount}`);
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={handleIncrementMultiple}>Add 3</button>
      <button onClick={handleAlertValue}>Increment & Alert</button>
    </div>
  );
}
```

### Step-by-Step Logic Solution
1. **Identify batching behaviors**: When mutating state sequentially, always favor functional state updates (`setCount(prev => prev + 1)`) over raw updates.
2. **Local variable synchronization**: If you need to access a newly updated value within the same event handler execution loop, compute it first, assign it to a constant, update state with the constant, and utilize that constant for secondary operations (e.g. APIs, alerts, tracking logs).

---

## 2. Component Lifecycles: Infinite Re-Renders in `useEffect`

### The Bug: Unstabilized Object/Function Dependencies
A `useEffect` runs whenever the values in its dependency array change (using standard `Object.is` reference comparison). If you pass an object literal, array literal, or non-stabilized function inside the dependency array, it will re-trigger on *every single render cycle*. If the effect updates state inside, this triggers another render, leading to an immediate **infinite loop of re-renders** which crashes the client browser.

### Bad Code (Anti-Pattern)
```tsx
import React, { useState, useEffect } from "react";

export function UserProfile({ userId }: { userId: string }) {
  const [userData, setUserData] = useState<any>(null);
  
  // ❌ Bug: Object literal defined inside the component recreates on every render.
  const fetchOptions = { headers: { Authorization: "Bearer TOKEN" } };

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`/api/users/${userId}`, fetchOptions);
      const data = await res.json();
      setUserData(data); // Triggers re-render -> fetchOptions recreates -> loop!
    };
    fetchData();
  }, [userId, fetchOptions]); // ❌ Infinite Render Loop Trigger

  return <div>{userData?.name}</div>;
}
```

### Good Code (Best Practice)
```tsx
import React, { useState, useEffect, useMemo } from "react";

export function UserProfile({ userId }: { userId: string }) {
  const [userData, setUserData] = useState<any>(null);

  // ✅ Solution 1: Memoize the object using useMemo to preserve reference equality
  const fetchOptions = useMemo(() => {
    return { headers: { Authorization: "Bearer TOKEN" } };
  }, []); // Empty dependency array means the reference stays constant across all renders

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`/api/users/${userId}`, fetchOptions);
      const data = await res.json();
      setUserData(data);
    };
    fetchData();
  }, [userId, fetchOptions]); // ✅ Safe dependency list

  return <div>{userData?.name}</div>;
}
```

### Step-by-Step Logic Solution
1. **Constant Hoisting**: If the dependency (like configuration options, static headers, or default objects) does not depend on component state or props, **hoist it completely outside** the component definition so it is created exactly once in memory.
2. **Memoize Complex References**: If the object relies on dynamic props, wrap it in a `useMemo(() => ({ key: prop }), [prop])` hook, or serialize it to primitive primitives (e.g., strings) to pass as dependencies.

---

## 3. Custom Hooks Best Practices

### The Bug: Re-Triggering Downstream Hooks
When designing custom hooks, returning un-memoized utility functions causes components consuming those hooks to recreate references on every render. This forces any downstream `useEffect` using those returned functions to prematurely execute.

### Bad Code (Anti-Pattern)
```tsx
import { useState } from "react";

// Custom hook to handle lists
export function useListManager() {
  const [items, setItems] = useState<string[]>([]);

  // ❌ Bug: Function gets recreated every render cycle.
  const addItem = (item: string) => {
    setItems(prev => [...prev, item]);
  };

  return { items, addItem };
}
```

### Good Code (Best Practice)
```tsx
import { useState, useCallback } from "react";

// Custom hook with optimized stabilized actions
export function useListManager() {
  const [items, setItems] = useState<string[]>([]);

  // ✅ Solution: Wrap callback in useCallback to maintain reference stability
  const addItem = useCallback((item: string) => {
    setItems(prev => [...prev, item]);
  }, []); // Constant memory reference

  return { items, addItem };
}
```

---

## 4. Performance Optimization Rules

1. **Keep Dependency Arrays Primitive**: Avoid using entire arrays or objects in hook dependency lists. Destructure to primitive types first (e.g. `const id = options.id; useEffect(..., [id])`).
2. **Memory Leaks and Cleanups**: Always return cleanups in your effects if they establish listeners, intervals, timeouts, or WebSocket streams:
   ```tsx
   useEffect(() => {
     const handler = () => console.log("clicked");
     window.addEventListener("click", handler);
     // ✅ Essential cleanup function to release listener memory
     return () => window.removeEventListener("click", handler);
   }, []);
   ```
3. **Lazy Load Large Sub-Components**: For widgets or drawers that are not visible on initial load, use dynamic importing to trim initial package bundle weights:
   ```tsx
   import dynamic from "next/dynamic";
   const LargeAnalyticsChart = dynamic(() => import("./Chart"), { ssr: false });
   ```
