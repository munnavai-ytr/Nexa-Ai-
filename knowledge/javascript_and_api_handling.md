# JavaScript & API Handling Best Practices Guide

This guide details correct asynchronous control flow patterns, REST API error-handling strategies, Promise architectures, and high-performance DOM interaction paradigms, with clear side-by-side **Bad Code vs. Good Code** demonstrations.

---

## 1. Async/Await: The Sequential Bottleneck Trap

### The Pitfall: Executing Independent asynchronous operations sequentially
When triggering multiple independent asynchronous tasks (e.g., retrieving user details, loading config parameters, and checking active server flags), awaiting each task sequentially forces the engine to run them in series. The second request does not start until the first resolves, creating an artificial performance bottleneck.

### Bad Code (Anti-Pattern)
```javascript
// ❌ Bug: Independent calls are awaited sequentially. Total wait time: ~6 seconds!
async function loadDashboardDetails(userId) {
  const profile = await fetchUserProfile(userId); // Waits 2s
  const preferences = await fetchPreferences(userId); // Waits 2s
  const telemetry = await fetchTelemetryMetrics(); // Waits 2s
  
  return { profile, preferences, telemetry };
}
```

### Good Code (Best Practice)
```javascript
// ✅ Solution: Leverage Promise.all to run requests concurrently in parallel
async function loadDashboardDetails(userId) {
  // Starts all asynchronous processes concurrently in parallel
  const [profile, preferences, telemetry] = await Promise.all([
    fetchUserProfile(userId),
    fetchPreferences(userId),
    fetchTelemetryMetrics()
  ]); // Total wait time optimized: ~2 seconds!

  return { profile, preferences, telemetry };
}
```

### Step-by-Step Logic Solution
1. **Identify Independent Promises**: Look at the requests in your routine. If request B does not require the output of request A, they are independent.
2. **Launch Concurrently**: Group all independent async functions inside `Promise.all([PromiseA, PromiseB, PromiseC])` to let the network layer handle them concurrently.

---

## 2. API Response Handling: Blind Parsing Failures

### The Bug: Unsafely calling `.json()` without verifying Status Codes
`fetch` only rejects a Promise if there is an actual network failure (e.g. DNS failure, physical server down). Response payloads with server error status codes (such as `500 Internal Server Error`, `401 Unauthorized`, or `404 Not Found`) resolve normally, meaning a simple `await fetch()` doesn't throw. If you immediately parse the payload, the application might fail silently or crash when attempting to process invalid keys.

### Bad Code (Anti-Pattern)
```javascript
async function fetchConfigProperties() {
  try {
    const response = await fetch("/api/properties");
    // ❌ Bug: If the server returns a 500 error, response.ok is false,
    // but we blindly call .json() anyway. This can trigger hard crashes.
    const data = await response.json();
    return data.serverStatus;
  } catch (err) {
    console.error("Caught error:", err);
  }
}
```

### Good Code (Best Practice)
```javascript
async function fetchConfigProperties() {
  try {
    const response = await fetch("/api/properties");
    
    // ✅ Solution: Explicitly verify response.ok status before parsing
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error Status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.serverStatus || "idle";
  } catch (err) {
    console.error("Failed to fetch configuration properties:", err.message);
    return "error-fallback";
  }
}
```

### Step-by-Step Logic Solution
1. **Check response status**: Always evaluate the `response.ok` property immediately after your `fetch` promise resolves.
2. **Process and Throw**: If `response.ok` is false, extract the body content using `response.text()` or read error codes, and explicitly throw an descriptive error block to your catcher.

---

## 3. Promise Error Handling: Unhandled Rejections

### The Pitfall: Swallowing or ignoring Promise failures
Failing to capture rejected promises results in unhandled runtime rejections which can leak memory or cause servers to crash.

### Bad Code (Anti-Pattern)
```javascript
function loadSystemModule() {
  // ❌ Bug: A rejection inside initializers isn't caught.
  initializeThirdPartySDK()
    .then(status => {
      console.log("Initialized", status);
    });
}
```

### Good Code (Best Practice)
```javascript
function loadSystemModule() {
  // ✅ Solution: Appending .catch() blocks or nesting in try/catch loops
  initializeThirdPartySDK()
    .then(status => {
      console.log("Initialized", status);
    })
    .catch(err => {
      console.error("SDK initialization failed, engaging local mock modes:", err);
    });
}
```

---

## 4. DOM Manipulation: Layout Thrashing Bottlenecks

### The Pitfall: Repetitive writes and reads triggering recalculation loops
Executing reads (e.g., measuring `offsetWidth`) and writes (e.g., mutating style properties) in a fast, repeated loop forces browsers to recompute layouts on every single loop iteration, severely slowing down rendering performance.

### Bad Code (Anti-Pattern)
```javascript
// ❌ Bug: Triggers layout recalculation thrashing on every cycle
function expandElementCards(elements) {
  for (let i = 0; i < elements.length; i++) {
    // Read offsetWidth (Forces browser layout)
    const currentWidth = elements[i].offsetWidth; 
    // Write styled width (Dirty layout flag)
    elements[i].style.width = (currentWidth + 10) + "px"; 
  }
}
```

### Good Code (Best Practice)
```javascript
// ✅ Solution: Batch all reads first, then batch writes to avoid style recalculation thrashing
function expandElementCards(elements) {
  // 1. Batch read widths
  const widths = elements.map(el => el.offsetWidth);

  // 2. Batch write styles in a single execution frame
  elements.forEach((el, index) => {
    el.style.width = (widths[index] + 10) + "px";
  });
}
```
*Tip: Also utilize `DocumentFragment` to batch bulk node additions to the live webpage to prevent repetitive layout calculations.*
