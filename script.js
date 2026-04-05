/* ai-chat-groq-llama-env-with-submit.js
   نسخة JavaScript جاهزة للعمل مع Groq أو Llama-like.
   - الـ API Key بيتقرأ من ملف .env (Node.js env في بيئات تدعم ذلك)
   - يتضمن تعريف زر الإرسال submitBtn وتعطيله أثناء الطلب
*/

require && typeof require === "function" && require('dotenv')?.config?.();

(() => {
  // عناصر DOM (تأكد من وجودها في الـ HTML)
  const chatsContainer = document.getElementById("chatsContainer");
  const promptForm = document.getElementById("promptForm");
  const promptInput = document.getElementById("promptInput");
  const submitBtn = document.getElementById("submitBtn"); // تعريف زر الإرسال
  const fileInput = document.getElementById("file-input");
  const attachBtn = document.getElementById("attachBtn");
  const statusEl = document.getElementById("status");

  // إعدادات افتراضية
  let provider = "groq"; // "groq" أو "llama"
  const API_KEY = (typeof process !== "undefined" && process.env) ? process.env.API_KEY : (window && window.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) || ""; // قراءة آمنة
  let API_URL = "https://api.groq.com/openai/v1/chat/completions";
  let MODEL = "gpt-like-model";
  let MAX_TOKENS = 800;
  let TEMPERATURE = 0.7;

  // --- رسالة system ---
  const chatHistory = [
    {
      role: "system",
      content: `انت مساعد مفيد وذكي اسمك "جي بي توربو"
مهمتك:
- التحدث بنفس اللغة اللتي يتحدث بها المستخدم ونفس اللهجة.
- ممنوع تداخل في اللغات واختراع كلمات.
- لا تذكر انك مدرب من Groq او Llama.
- كن محترما, مفيدا.
- الرد يكون مباشرا, مفهوما, واضحا.
- لا تذكر انك ذكاء اصطناعي لغوي`
    }
  ];

  let controller = null;
  let typingInterval = null;
  let lastUserMessage = null;

  // --- مساعدة للتمرير ---
  function scrollToBottom() {
    if (!chatsContainer) return;
    chatsContainer.scrollTo({ top: chatsContainer.scrollHeight, behavior: "smooth" });
  }

  // --- تأثير كتابة تدريجي ---
  function typingEffect(text, element, speed = 30) {
    clearInterval(typingInterval);
    if (!element) return;
    element.textContent = "";
    const words = text.split(" ");
    let i = 0;
    typingInterval = setInterval(() => {
      if (i >= words.length) {
        clearInterval(typingInterval);
        typingInterval = null;
        return;
      }
      element.textContent += (i === 0 ? "" : " ") + words[i++];
      scrollToBottom();
    }, speed);
  }

  // --- إلحاق رسالة في الواجهة ---
  function appendMessage(text, who = "bot") {
    if (!chatsContainer) return null;
    const div = document.createElement("div");
    div.className = `msg ${who === "user" ? "user" : "bot"}`;
    div.setAttribute("role", "article");
    div.textContent = text;
    chatsContainer.appendChild(div);
    scrollToBottom();
    return div;
  }

  function setStatus(text) { if (statusEl) statusEl.textContent = text; }

  // --- تمكين/تعطيل زر الإرسال ---
  function setSubmitEnabled(enabled) {
    if (!submitBtn) return;
    submitBtn.disabled = !enabled;
    submitBtn.setAttribute("aria-disabled", (!enabled).toString());
  }

  // --- بناء الـ payload ---
  function buildPayload(message) {
    if (provider === "groq") {
      return {
        model: MODEL,
        messages: [
          ...chatHistory.map(h => ({ role: h.role, content: h.content })),
          { role: "user", content: message }
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE
      };
    } else if (provider === "llama") {
      return {
        model: MODEL,
        input: {
          history: chatHistory.map(h => ({ role: h.role, content: h.content })),
          prompt: message
        },
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE
      };
    } else {
      return {
        model: MODEL,
        messages: [
          ...chatHistory.map(h => ({ role: h.role, content: h.content })),
          { role: "user", content: message }
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE
      };
    }
  }

  // --- استخراج النص من الاستجابة ---
  function extractTextFromResponse(data) {
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return data.choices[0].message.content;
    }
    if (data.output && typeof data.output === "string") return data.output;
    if (data.text && typeof data.text === "string") return data.text;
    if (data.answer && typeof data.answer === "string") return data.answer;
    try {
      return JSON.stringify(data).slice(0, 2000);
    } catch (e) {
      return "";
    }
  }

  // --- إرسال للـ API ---
  async function sendToAI(message, { signal } = {}) {
    lastUserMessage = message;
    setStatus("جاري الاتصال...");
    setSubmitEnabled(false);
    try {
      const payload = buildPayload(message);
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: signal || null
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${text}`);
      }

      const data = await res.json();
      const aiText = extractTextFromResponse(data);

      if (!aiText || aiText.trim().length < 2) {
        return { ok: false, text: "⚠️ الرد غير واضح، جرّب إعادة الصياغة." };
      }

      chatHistory.push({ role: "assistant", content: aiText });
      return { ok: true, text: aiText };
    } catch (err) {
      if (err.name === "AbortError") return { ok: false, text: "تم إلغاء الطلب." };
      console.error("sendToAI error:", err);
      return { ok: false, text: "❌ خطأ في الاتصال أو في الخادم." };
    } finally {
      setStatus("جاهز");
      setSubmitEnabled(true);
    }
  }

  // --- إرسال رسالة من الواجهة ---
  async function submitMessage(message) {
    if (!message || !message.trim()) return;
    appendMessage(message, "user");
    chatHistory.push({ role: "user", content: message });
    scrollToBottom();

    if (controller) { try { controller.abort(); } catch (e) {} }
    controller = new AbortController();

    const botDiv = appendMessage("...", "bot");
    typingEffect("جاري التفكير والرد...", botDiv);

    const result = await sendToAI(message, { signal: controller.signal });

    clearInterval(typingInterval);
    typingInterval = null;
    if (botDiv) botDiv.textContent = "";

    if (result.ok) typingEffect(result.text, botDiv);
    else if (botDiv) botDiv.textContent = result.text;
  }

  function abortCurrentRequest() {
    if (controller) { try { controller.abort(); controller = null; setStatus("ملغي"); setSubmitEnabled(true); } catch (e) { console.warn(e); } }
    else setStatus("لا يوجد طلب جاري");
  }

  async function retryLast() {
    if (!lastUserMessage) { setStatus("لا توجد رسالة سابقة"); return; }
    appendMessage("🔁 إعادة محاولة: " + lastUserMessage, "user");
    chatHistory.push({ role: "user", content: lastUserMessage });
    await submitMessage(lastUserMessage);
  }

  // --- تعديل إعدادات في وقت التشغيل ---
  function setApiCredentials({ apiKey, apiUrl, prov, model, maxTokens, temperature } = {}) {
    if (apiKey) {
      // لا تحفظ المفتاح هنا عند المشاركة؛ استخدم .env أو متغير بيئة في الإنتاج
    }
    if (apiUrl) API_URL = apiUrl;
    if (prov) provider = prov;
    if (model) MODEL = model;
    if (typeof maxTokens === "number") MAX_TOKENS = maxTokens;
    if (typeof temperature === "number") TEMPERATURE = temperature;
    setStatus(`مزود: ${provider} | موديل: ${MODEL}`);
  }

  function resetChat() {
    const systemMsg = chatHistory.find(h => h.role === "system");
    chatHistory.length = 0;
    if (systemMsg) chatHistory.push(systemMsg);
    lastUserMessage = null;
    if (chatsContainer) chatsContainer.innerHTML = "";
    appendMessage("مرحبًا! اكتب سؤالك واضغط إرسال.", "bot");
  }

  // --- رفع ملف بسيط ---
  if (attachBtn && fileInput) {
    attachBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      appendMessage(`📎 ملف مرفق: ${file.name}`, "user");
      chatHistory.push({ role: "user", content: `[ملف مرفق: ${file.name}]` });
    });
  }

  // --- تعامل مع الفورم وزر الإرسال ---
  if (promptForm && promptInput) {
    // تأكد أن زر الإرسال موجود لتجربة أفضل
    if (submitBtn) {
      submitBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const message = promptInput.value.trim();
        if (!message) return;
        promptInput.value = "";
        submitMessage(message);
      });
    }

    // دعم الضغط على Enter داخل الحقل
    promptForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const message = promptInput.value.trim();
      if (!message) return;
      promptInput.value = "";
      await submitMessage(message);
    });

    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); promptForm.requestSubmit(); }
    });
  }

  // --- تهيئة أولية ---
  (function init() {
    if (!chatsContainer) { console.warn("عنصر chatsContainer غير موجود."); return; }
    appendMessage("مرحبًا! اكتب سؤالك واضغط إرسال.", "bot");
    setStatus(`جاهز | مزود: ${provider}`);
    setSubmitEnabled(true);
  })();

  // --- تصدير وظائف للتجربة من الكونسول ---
  window.aiChat = {
    submitMessage,
    sendToAI,
    appendMessage,
    resetChat,
    getHistory: () => chatHistory.slice(),
    abortCurrentRequest,
    retryLast,
    setApiCredentials,
    setProvider: (p) => { provider = p; setStatus("مزود: " + provider); }
  };
})();
