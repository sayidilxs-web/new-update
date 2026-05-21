// toolRunner.js
// এই ফাইলটি customModules.js থেকে প্রাপ্ত সব টুল চালাবে এবং ফলাফল একত্র করবে।

async function runCustomTools({ modules, fusionData, emitFeed }) {
  if (!fusionData.custom) fusionData.custom = {};
  if (!fusionData.custom.results) fusionData.custom.results = {};

  const toolEntries = Object.entries(modules).filter(([name]) => name !== 'tool_generateUnifiedReport');
  const totalTools = toolEntries.length;
  emitFeed('info', `🚀 ১৫০টি টুল একসাথে (Parallel) চালানো শুরু হচ্ছে...`);

  // রান অল টুলস ইন প্যারালাল
  const toolPromises = toolEntries.map(async ([name, toolFn]) => {
    try {
      // প্রতিটি টুল ব্রাউজার ট্রাফিক (fusionData.traffic.events) নিয়ে কাজ করবে
      const result = await toolFn({ targetUrl: fusionData.target.url, fusionData, emitFeed });
      
      if (result && typeof result === 'object') {
        fusionData.custom.results[name] = result;
      }
    } catch (err) {
      fusionData.custom.results[name] = { ok: false, error: err.message || String(err) };
    }
  });

  await Promise.all(toolPromises);
  emitFeed('success', `🎉 সব টুল স্ক্যান সম্পন্ন করেছে এবং তথ্য জমা করেছে।`);

  // শেষে একীভূত রিপোর্ট তৈরি
  if (typeof modules.tool_generateUnifiedReport === 'function') {
    await modules.tool_generateUnifiedReport({ targetUrl: fusionData.target.url, fusionData, emitFeed });
  }

  return { ok: true, total: totalTools };
}

module.exports = { runCustomTools };