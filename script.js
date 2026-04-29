// script.js - كامل ومتكامل
// ====== إعدادات DOM وتهيئة ======
const container = document.querySelector('.container');
const chatsContainer = document.querySelector('.chats-container');
const promptForm = document.querySelector('.prompt-form');
const promptInput = promptForm?.querySelector('.prompt-input');
const fileInput = promptForm?.querySelector('#file-input');
const fileUploadWrapper = promptForm?.querySelector('.file-upload-wrapper');
const themeToggle = document.querySelector('#theme-toggle-btn');
const sendBtn = document.querySelector('#send-prompt-btn');

// ضع هنا عنوان الـ Worker الصحيح (غيره لو لازم)
const API_URL = "https://codex.omarelmoghazy2016.dev/"; // <-- عدّله إذا عندك دومين مختلف

let typingInterval = null;
let controller = null;

const chatHistory = [];
const userData = { message: '', file: {} };

// ====== مساعدة التمرير وتأثير الكتابة ======
const scrollToBottom = () => {
  if (!container) return;
  container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
};

const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.textContent = '';
  const words = String(text).split(' ');
  let wordIndex = 0;

  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent += (wordIndex === 0 ? '' : ' ') + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      typingInterval = null;
      botMsgDiv.classList.remove('loading');
      document.body.classList.remove('bot-responding');
    }
  }, 30);
};

// ====== دوال مساعدة للعرض ======
function escapeHtml(s) {
  return String(s || '')
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createMsgElement(innerHTML, cls = '', extraClass = '') {
  const wrapper = document.createElement('div');
  wrapper.className = `${cls} ${extraClass}`.trim();
  wrapper.innerHTML = innerHTML;
  return wrapper;
}

function appendUserMessage(text) {
  const html = `<p class="message-text">${escapeHtml(text)}</p>`;
  const el = createMsgElement(html, 'user-message');
  chatsContainer.appendChild(el);
  scrollToBottom();
  return el;
}

function appendBotPlaceholder() {
  const botMsgHTML = `<img src="" class="avatar" alt="bot"><p class="message-text"></p>`;
  const botDiv = createMsgElement(botMsgHTML, 'bot-message', 'loading');
  chatsContainer.appendChild(botDiv);
  scrollToBottom();
  return botDiv;
}

// ====== الدالة الأساسية: إرسال الطلب للـ Worker ومعالجة الرد ======
const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector('.message-text');
  controller = new AbortController();

  // بناء أجزاء رسالة المستخدم (نص + ملف إن وُجد)
  const userParts = [{ text: userData.message }];
  if (userData.file && userData.file.data) {
    userParts.push({
      inline_data: {
        fileName: userData.file.fileName,
        isImage: userData.file.isImage,
        mime_type: userData.file.mime_type,
        data: userData.file.data,
      },
    });
  }

  // أضف رسالة المستخدم إلى الـ chatHistory
  chatHistory.push({
    role: 'user',
    parts: userParts,
  });

  const payload = { contents: chatHistory };

  // DEBUG logs (تقدر تشيلها بعد التأكد)
  console.log('API_URL:', API_URL);
  console.log('Payload:', payload);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    console.log('Response status:', response.status, response.statusText);
    const contentType = response.headers.get('content-type') || '';
    console.log('Response content-type:', contentType);

    let data;
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
        console.log('Parsed JSON response:', data);
      } catch (e) {
        const raw = await response.text().catch(() => '');
        console.warn('Failed to parse JSON, raw response:', raw);
        data = { rawText: raw };
      }
    } else {
      const text = await response.text().catch(() => '');
      data = { rawText: text };
    }

    if (!response.ok) {
      const errMsg =
        data?.error?.message ||
        data?.message ||
        data?.rawText ||
        response.statusText ||
        `HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    // استخراج نص الرد حسب بنية البيانات المتوقعة
    let responseText = '';
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = data.candidates[0].content.parts[0].text;
    } else if (data?.result?.output || data?.output) {
      responseText = data.result?.output || data.output;
    } else if (data?.rawText) {
      responseText = data.rawText;
    } else if (data?.result) {
      responseText = JSON.stringify(data.result);
    } else {
      responseText = JSON.stringify(data);
    }

    // تبسيط Markdown بسيط
    responseText = responseText.replace(/\*\*(.*?)\*\*/g, '$1').trim();

    // أضف رد البوت إلى الـ chatHistory
    chatHistory.push({ role: 'model', parts: [{ text: responseText }] });

    // شغّل تأثير الكتابة
    typingEffect(responseText, textElement, botMsgDiv);
  } catch (error) {
    console.error('Response Error:', error);
    textElement.style.color = '#d92939';
    textElement.textContent =
      error.name === 'AbortError' ? 'تم إيقاف الرد.' : error.message || 'حدث خطأ';
    botMsgDiv.classList.remove('loading');
    document.body.classList.remove('bot-responding');
  } finally {
    // نظف الملف المرفوع بعد المحاولة
    userData.file = {};
    sendBtn.disabled = false;
  }
};

// ====== معالجة إرسال النموذج (زر الإرسال أو Enter) ======
const handleFormSubmit = (e) => {
  e?.preventDefault();
  const userMessage = promptInput?.value?.trim();
  if (!userMessage || document.body.classList.contains('bot-responding')) return;

  // مسح الحقل وإعداد البيانات
  promptInput.value = '';
  userData.message = userMessage;
  document.body.classList.add('bot-responding', 'chats-active');
  fileUploadWrapper?.classList.remove('active', 'img-attached', 'file-attached');

  // عرض رسالة المستخدم
  appendUserMessage(userMessage);

  // عرض عنصر بوت مؤقت وتحضير الاستجابة
  const botMsgDiv = appendBotPlaceholder();
  botMsgDiv.querySelector('.message-text').textContent = ''; // فارغ لبدء typingEffect
  generateResponse(botMsgDiv);
};

// ====== رفع الملف وتحويله إلى base64 ======
if (fileInput) {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
      fileInput.value = '';
      const base64String = e.target.result.split(',')[1];
      const preview = fileUploadWrapper?.querySelector('.file-preview');
      if (preview) preview.src = e.target.result;
      fileUploadWrapper?.classList.add('active', isImage ? 'img-attached' : 'file-attached');

      userData.file = {
        fileName: file.name,
        data: base64String,
        mime_type: file.type,
        isImage,
      };
    };
  });
}

// زر إلغاء الملف
const cancelFileBtn = document.querySelector('#cancel-file-btn');
if (cancelFileBtn) {
  cancelFileBtn.addEventListener('click', () => {
    userData.file = {};
    fileUploadWrapper?.classList.remove('active', 'img-attached', 'file-attached');
  });
}

// ====== أزرار التحكم: إيقاف الاستجابة، حذف المحادثات ======
const stopResponseBtn = document.querySelector('#stop-response-btn');
if (stopResponseBtn) {
  stopResponseBtn.addEventListener('click', () => {
    userData.file = {};
    controller?.abort();
    if (typingInterval) {
      clearInterval(typingInterval);
      typingInterval = null;
    }
    const loadingBot = chatsContainer.querySelector('.bot-message.loading');
    if (loadingBot) loadingBot.classList.remove('loading');
    document.body.classList.remove('bot-responding');
  });
}

const deleteChatsBtn = document.querySelector('#delete-chats-btn');
if (deleteChatsBtn) {
  deleteChatsBtn.addEventListener('click', () => {
    chatHistory.length = 0;
    chatsContainer.innerHTML = '';
    document.body.classList.remove('bot-responding', 'chats-active');
  });
}

// ====== اقتراحات جاهزة (suggestions) ======
document.querySelectorAll('.suggestions-item').forEach((item) => {
  item.addEventListener('click', () => {
    const textEl = item.querySelector('.text');
    if (textEl) {
      promptInput.value = textEl.textContent;
      promptForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
});

// ====== تبديل الثيم ======
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isLightTheme = document.body.classList.toggle('light-theme');
    localStorage.setItem('themeColor', isLightTheme ? 'light_mode' : 'dark_mode');
    themeToggle.textContent = isLightTheme ? 'dark_mode' : 'light_mode';
  });

  const isLightTheme = localStorage.getItem('themeColor') === 'light_mode';
  document.body.classList.toggle('light-theme', isLightTheme);
  themeToggle.textContent = isLightTheme ? 'dark_mode' : 'light_mode';
}

// ====== إرسال عبر الزر وEnter ======
if (sendBtn) {
  sendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    promptForm.dispatchEvent(new Event('submit', { cancelable: true }));
  });
} else {
  console.warn('زر الإرسال #send-prompt-btn غير موجود في الـ HTML');
}

if (promptInput) {
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      promptForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
}

// ربط النموذج
if (promptForm) {
  promptForm.addEventListener('submit', handleFormSubmit);
}

// إظهار/إخفاء عناصر التحكم عند النقر خارجها
document.addEventListener('click', ({ target }) => {
  const wrapper = document.querySelector('.prompt-wrapper');
  if (!wrapper) return;

  const shouldHide =
    target.classList.contains('prompt-input') ||
    (wrapper.classList.contains('hide-controls') &&
      (target.id === 'add-file-btn' || target.id === 'stop-response-btn'));

  wrapper.classList.toggle('hide-controls', shouldHide);
});

// تهيئة مبدئية
(function init() {
  promptInput?.focus();
  // اختبار خفيف للتأكد من أن الـ Worker متاح (اختياري)
  (async function smokeTest() {
    try {
      const r = await fetch(API_URL, { method: 'OPTIONS' });
      console.log('OPTIONS status', r.status);
    } catch (e) {
      console.warn('Smoke test failed', e);
    }
  })();
})();
