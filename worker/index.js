export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // اختبار تشغيل Worker
    if (request.method === "GET") {
      return new Response(JSON.stringify({ ok: true, message: "Worker is running" }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" }
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Only POST allowed" }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // قراءة JSON من الطلب
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body", details: e.message }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // تجهيز payload بصيغ مرنة
    let payload;
    if (body.contents) payload = body;
    else if (body.text) payload = { contents: [{ parts: [{ text: body.text }] }] };
    else if (Array.isArray(body.texts)) payload = { contents: body.texts.map(t => ({ parts: [{ text: t }] })) };
    else if (Array.isArray(body.chatHistory)) payload = { contents: body.chatHistory };
    else {
      return new Response(JSON.stringify({ error: "Request must include contents, text, texts, or chatHistory" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // تنظيف inline_data: احتفظ فقط بالحقول المسموح بها
    const allowedInlineFields = ["mime_type", "data"];
    if (Array.isArray(payload.contents)) {
      payload.contents.forEach(content => {
        if (!Array.isArray(content.parts)) return;
        content.parts.forEach(part => {
          if (!part.inline_data || typeof part.inline_data !== "object") return;
          const clean = {};
          for (const k of allowedInlineFields) if (k in part.inline_data) clean[k] = part.inline_data[k];
          if (Object.keys(clean).length) part.inline_data = clean; else delete part.inline_data;
        });
      });
    }

    // احصل على المفتاح من متغير البيئة
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const text = await upstream.text();
      const contentType = upstream.headers.get("content-type") || "";

      const headers = { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" };

      if (contentType.includes("application/json")) {
        return new Response(text, { status: upstream.status, headers });
      } else {
        return new Response(JSON.stringify({ rawText: text }), { status: upstream.status, headers });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: "Upstream request failed", details: err.message }), {
        status: 502,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" }
      });
    }
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://omarandmansour.github.io/GP-Turbo/",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

