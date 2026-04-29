// script.js (معدّل)
const container = document.querySelector('.container');
const chatsContainer = document.querySelector('.chats-container');
const promptForm = document.querySelector('.prompt-form');
const promptInput = promptForm.querySelector('.prompt-input');
const fileInput = promptForm.querySelector('#file-input');
const fileUploadWrapper = promptForm.querySelector('.file-upload-wrapper');
const themeToggle = document.querySelector('#theme-toggle-btn');

const API_URL = `https://codex.omarelmoghazy2016.workers.dev`;

let typingInterval = null;
let controller = null;

const chatHistory = [];
const userData = { message: '', file: {} };

const scrollToBottom = () => {
  container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
};

const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.textContent = '';
  const words = text.split(' ');
  let wordIndex = 0;

  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent +=
        (wordIndex === 0 ? '' : ' ') + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      typingInterval = null;
      botMsgDiv.classList.remove('loading');
      document.body.classList.remove('bot-responding');
    }
  }, 40);
};

const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector('.message-text');
  controller = new AbortController();

  const userParts = [{ text: userData.message }];

  if (userData.file && userData.file.data) {
    userParts.push({
      inline_data: {
        fileName: userData.file.fileName,
        isImage: !!userData.file.isImage,
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

  // DEBUG: طباعة الرابط والبيانات قبل الإرسال
  console.log('API_URL:', API_URL);
  console.log('Payload:', payload);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // DEBUG: طباعة حالة الاستجابة
    console.log('Response status:', response.status, response.statusText);
    const contentType = response.headers.get('content-type') || '';
    console.log('Response content-type:', contentType);

    let data;
    if (contentType.includes('application/json')) {
      // محاولة قراءة JSON مع حماية من خطأ parse
      try {
        data = await response.json();
        console.log('Response JSON:', data);
      } catch (e) {
        const raw = await response.text();
        console.warn('Failed to parse JSON, raw response:', raw);
        data = { rawText: raw };
      }
    } else {
      const text = await response.text();
      data = { rawText: text };
      console.log('Response text:', text);
    }

    if (!response.ok) {
      const errMsg =
        data?.error?.message ||
        data?.message ||
        data?.rawText ||
        response.statusText;
      throw new Error(`Server error: ${errMsg} (status ${response.status})`);
    }

    // استخراج نص الرد
    let responseText = '';
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = data.candidates[0].content.parts[0].text;
    } else if (data?.output) {
      responseText = data.output;
    } else if (data?.rawText) {
      responseText = data.rawText;
    } else {
      responseText = JSON.stringify(data);
    }

    responseText = responseText.replace(/\*\*([^*]+)\*\*/g, '$1').trim();
    typingEffect(responseText, textElement, botMsgDiv);
    chatHistory.push({ role: 'model', parts: [{ text: responseText }] });
  } catch (error) {
    console.error('generateResponse error:', error);
    textElement.style.color = '#d92939';
    if (error.name === 'AbortError') {
      textElement.textContent = 'تم توقيف التفكير.';
    } else if (error.message.includes('Failed to fetch')) {
      textElement.textContent =
        'فشل الاتصال بالخادم. احتمال مشكلة CORS أو الشبكة.';
    } else {
      textElement.textContent = error.message;
    }
    botMsgDiv.classList.remove('loading');
    document.body.classList.remove('bot-responding');
  } finally {
    userData.file = {};
  }
};

// أضف رسالة المستخدم إلى الـ chatHistory
chatHistory.push({
  role: 'user',
  parts: userParts,
});

try {
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: chatHistory }),
    signal: controller.signal,
  });

  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    // لو رجع نص خام
    const text = await response.text();
    data = { rawText: text };
  }

  if (!response.ok) {
    // حاول استخراج رسالة الخطأ من الجسم لو موجودة
    const errMsg =
      data?.error?.message ||
      data?.message ||
      data?.rawText ||
      response.statusText;
    throw new Error(errMsg);
  }

  // استخراج نص الرد من صيغ مختلفة
  let responseText = '';
  if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    responseText = data.candidates[0].content.parts[0].text;
  } else if (data?.output) {
    responseText = data.output;
  } else if (data?.rawText) {
    responseText = data.rawText;
  } else {
    responseText = JSON.stringify(data);
  }

  // تنظيف Markdown بسيط (مثال)
  responseText = responseText.replace(/\*\*([^*]+)\*\*/g, '$1').trim();

  // تأثير الكتابة
  typingEffect(responseText, textElement, botMsgDiv);

  // أضف رد الموديل إلى الـ chatHistory
  chatHistory.push({ role: 'model', parts: [{ text: responseText }] });
} catch (error) {
  textElement.style.color = '#d92939';
  textElement.textContent =
    error.name === 'AbortError' ? 'تم توقيف التفكير.' : error.message;
  botMsgDiv.classList.remove('loading');
  document.body.classList.remove('bot-responding');
  console.error('generateResponse error:', error);
} finally {
  // إعادة تهيئة ملف المستخدم بعد كل محاولة
  userData.file = {};
}

// معالجة إرسال الفورم
const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains('bot-responding'))
    return;

  promptInput.value = '';
  userData.message = userMessage;
  document.body.classList.add('bot-responding', 'chats-active');
  fileUploadWrapper.classList.remove('active', 'img-attached', 'file-attached');

  const userMsgHTML = `
    <p class="message-text"></p>
    ${userData.file.data ? (userData.file.isImage ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment"/>` : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ''}`;
  const userMsgDiv = createMsgElement(userMsgHTML, 'user-message');

  // ضع نص المستخدم بأمان داخل العنصر المخصص
  userMsgDiv.querySelector('.message-text').textContent = userMessage;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  setTimeout(() => {
    const botMsgHTML = `<img src="b8ec91ba-f021-411e-bdf9-29359107b7fd_removalai_preview.png" class="avatar"><p class="message-text"><img src="output-onlinegiftools.gif" style="width: 50px;"></p>`;
    const botMsgDiv = createMsgElement(botMsgHTML, 'bot-message', 'loading');
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 600);
};

// رفع ملف وإعداد base64
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  const isImage = file.type.startsWith('image/');
  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = (e) => {
    fileInput.value = '';
    const base64String = e.target.result.split(',')[1];
    const preview = fileUploadWrapper.querySelector('.file-preview');
    if (preview) preview.src = e.target.result;
    fileUploadWrapper.classList.add(
      'active',
      isImage ? 'img-attached' : 'file-attached',
    );

    userData.file = {
      fileName: file.name,
      data: base64String,
      mime_type: file.type,
      isImage,
    };
  };
});

// إلغاء الملف المرفوع
const cancelFileBtn = document.querySelector('#cancel-file-btn');
if (cancelFileBtn) {
  cancelFileBtn.addEventListener('click', () => {
    userData.file = {};
    fileUploadWrapper.classList.remove(
      'active',
      'img-attached',
      'file-attached',
    );
  });
}

// إيقاف الاستجابة الجارية
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

// حذف المحادثات
const deleteChatsBtn = document.querySelector('#delete-chats-btn');
if (deleteChatsBtn) {
  deleteChatsBtn.addEventListener('click', () => {
    chatHistory.length = 0;
    chatsContainer.innerHTML = '';
    document.body.classList.remove('bot-responding', 'chats-active');
  });
}

// اقتراحات سريعة
document.querySelectorAll('.suggestions-item').forEach((item) => {
  item.addEventListener('click', () => {
    const textEl = item.querySelector('.text');
    if (textEl) {
      promptInput.value = textEl.textContent;
      // إرسال الفورم بشكل صحيح
      promptForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
});

// إظهار/إخفاء عناصر التحكم بناءً على النقر
document.addEventListener('click', ({ target }) => {
  const wrapper = document.querySelector('.prompt-wrapper');
  if (!wrapper) return;

  const shouldHide =
    target.classList.contains('prompt-input') ||
    (wrapper.classList.contains('hide-controls') &&
      (target.id === 'add-file-btn' || target.id === 'stop-response-btn'));

  wrapper.classList.toggle('hide-controls', shouldHide);
});

// تبديل الثيم
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isLightTheme = document.body.classList.toggle('light-theme');
    localStorage.setItem(
      'themeColor',
      isLightTheme ? 'light_mode' : 'dark_mode',
    );
    themeToggle.textContent = isLightTheme ? 'dark_mode' : 'light_mode';
  });

  const isLightTheme = localStorage.getItem('themeColor') === 'light_mode';
  document.body.classList.toggle('light-theme', isLightTheme);
  themeToggle.textContent = isLightTheme ? 'dark_mode' : 'light_mode';
}

// ربط الفورم بزر الإرسال
promptForm.addEventListener('submit', handleFormSubmit);

// زر إضافة ملف
const addFileBtn = promptForm.querySelector('#add-file-btn');
if (addFileBtn) {
  addFileBtn.addEventListener('click', () => fileInput.click());
}

// تلميحات لوحة المفاتيح: Enter لإرسال، Shift+Enter لسطر جديد
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    promptForm.dispatchEvent(new Event('submit', { cancelable: true }));
  }
});

// تهيئة بسيطة
(function init() {
  promptInput.focus();
})();
