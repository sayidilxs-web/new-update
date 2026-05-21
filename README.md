# ShadowRecon Base – Custom Ready

এটি একটি **ডিফেন্সিভ** Electron ডেস্কটপ অ্যাপ। এতে আছে:
- Cyberpunk + glassmorphism UI
- Built‑in Chromium WebView (ব্রাউজিং)
- **Redacted** traffic timing log (শুধু URL/Status/Time/Type; **কুকি/হেডার লগ হয় না**)
- Integrated defensive checks (HTTP headers, TLS certificate, cookie flags via `Set-Cookie`, mixed content hints, robots/sitemap, dependency hints)
- রিপোর্ট ZIP export (Downloads ফোল্ডারে)
- **Custom Tools** প্লাগ‑ইন ফ্লো (আপনি `customModules.js` + `toolRunner.js` এ আপনার কোড যোগ করবেন)

> নোট: এই অ্যাপ আক্রমণাত্মক/অনৈতিক কোনো ফিচার প্রদান করে না। এখানে শুধুমাত্র কনফিগারেশন রিভিউ ও হার্ডেনিং‑হিন্টস ধরনের ডিফেন্সিভ চেক আছে।

---

## 1) রান/বিল্ড

### ডেভেলপমেন্ট রান
```bash
npm install
npm start
```

### Windows Installer build (EXE)
```bash
npm run build
```

`dist/` ফোল্ডারের ভিতরে NSIS installer তৈরি হবে।

---

## 2) কাস্টম টুল কীভাবে যোগ করবেন

এই প্রজেক্টে দুইটি ফাইল ইচ্ছাকৃতভাবে স্টাব রাখা হয়েছে:
- `customModules.js`
- `toolRunner.js`

আপনি আপনার নিজের টুলগুলো যোগ করতে এই দুই ফাইল পরিবর্তন করবেন।

### A) `customModules.js` এ টুল ফাংশন লেখা

আপনার টুল ফাংশনের কনভেনশন:
- **async function** হতে পারে
- ইনপুট হিসেবে সাধারণত একটি অবজেক্ট নিন: `{ targetUrl, fusionData, emitFeed }`
- আউটপুট লিখুন: `fusionData.custom.results.<toolName> = ...`

উদাহরণ:
```js
async function myHeaderNoteTool({ targetUrl, fusionData, emitFeed }) {
  emitFeed('info', `myHeaderNoteTool: ${targetUrl}`);
  fusionData.custom.results.myHeaderNoteTool = {
    ok: true,
    note: "Implement your own logic here"
  };
  return fusionData.custom.results.myHeaderNoteTool;
}

async function getCustomModules() {
  return {
    myHeaderNoteTool
  };
}

module.exports = { getCustomModules };
```

### B) `toolRunner.js` এ টুল চালানো + `fusionData` আপডেট

`toolRunner.js` এর কাজ:
- `customModules.js` থেকে পাওয়া মডিউলগুলোর ফাংশনগুলো একে একে চালানো
- প্রতিটির ফলাফল `fusionData.custom.results` এ জমা রাখা
- UI feed এ স্ট্যাটাস দেখানো (`emitFeed`)

উদাহরণ:
```js
async function runCustomTools({ modules, fusionData, emitFeed }) {
  fusionData.custom.results = fusionData.custom.results || {};

  for (const [name, fn] of Object.entries(modules)) {
    try {
      if (typeof fn !== 'function') continue;
      emitFeed('info', `Running ${name}…`);
      const out = await fn({ targetUrl: fusionData.target.url, fusionData, emitFeed });
      fusionData.custom.results[name] = out;
      emitFeed('success', `${name} completed`);
    } catch (e) {
      fusionData.custom.results[name] = { ok: false, error: String(e.message || e) };
      emitFeed('warn', `${name} failed: ${String(e.message || e)}`);
    }
  }
}

module.exports = { runCustomTools };
```

### C) UI থেকে Custom Tools রান

UI‑তে থাকা **“🔧 RUN CUSTOM TOOLS (PLACEHOLDER)”** বাটন ক্লিক করলে `main.js` এর `runUserTools()` চালু হয়।  
যদি `customModules.js`/`toolRunner.js` ইমপ্লিমেন্ট না করা থাকে, UI feed এ দেখাবে:
> ⚠️ Custom tools not implemented. Please edit customModules.js and toolRunner.js to add your own tools.

---

## 3) কোন ফাইল বদলালে রিবিল্ড দরকার

- `main.js`, `preload.js`, `package.json` পরিবর্তন করলে: অ্যাপ রিস্টার্ট লাগবে (`npm start` রিস্টার্ট)
- `index.html`, `style.css`, `renderer.js` পরিবর্তন করলে: সাধারণত রিস্টার্ট লাগবে (Electron default live reload নেই)
- `customModules.js`, `toolRunner.js` পরিবর্তন করলে: রিস্টার্ট করে রান করুন
- ইনস্টলার দরকার হলে: আবার `npm run build`

---

## 4) রিপোর্ট ও ZIP Export

- ডিফেন্সিভ চেক চালালে রিপোর্ট (Markdown + JSON) অ্যাপের userData ডিরেক্টরিতে সেভ হয়।
- **“📦 COMPRESS ALL REPORTS”** বাটন চাপলে সব রিপোর্ট + traffic snapshot + fusionData snapshot একসাথে ZIP হয়ে **Downloads** ফোল্ডারে সেভ হয়।

