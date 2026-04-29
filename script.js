// script.js مصحح ومتكامل
const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm?.querySelector(".prompt-input");
const fileInput = promptForm?.querySelector("#file-input");
const fileUploadWrapper = promptForm?.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");
const sendBtn = document.querySelector("#send-prompt-btn");

// غيّر لو endpoint مختلف
const API_URL = "server.php";

let typingInterval = null;
let controller = null;

const chatHistory = [];
const userData = { message: "", file: {} };

const scrollToBottom = () => {
  if (!container) return;
  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
};

const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.textContent = "";
  const words = String(text).split(" ");
  let wordIndex = 0;

  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      typingInterval = null;
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
    }
  }, 40);
};

const createMsgElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();

  // بناء parts للرسالة مع دعم الملف إن وُجد
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

  chatHistory.push({
    role: "user",
    parts: userParts,
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text().catch(() => "");
    let data = null;
    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { rawText: raw };
      }
    } else {
      data = { rawText: raw };
    }

    if (!response.ok) {
      const errMsg =
        data?.error?.message || data?.message || data?.rawText || response.statusText || `HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    // استخراج نص الرد بأمان
    let responseText = "";
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = data.candidates[0].content.parts[0].text;
    } else if (data?.result?.output || data?.output) {
      responseText = data.result?.output || data.output;
    } else if (data?.rawText) {
      responseText = data.rawText;
    } else {
      responseText = JSON.stringify(data);
    }

    responseText = responseText.replace(/\*\*(.*?)\*\*/g, "$1").trim();

    // أضف رد البوت إلى التاريخ وشغّل تأثير الكتابة
    chatHistory.push({ role: "model", parts: [{ text: responseText }] });
    typingEffect(responseText, textElement, botMsgDiv);
  } catch (error) {
    console.error("generateResponse error:", error);
    textElement.style.color = "#d92939";
    textElement.textContent = error.name === "AbortError" ? "تم توقيف التفكير." : error.message || "حدث خطأ";
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
  } finally {
    userData.file = {};
  }
};

const handleFormSubmit = (e) => {
  e?.preventDefault();
  const userMessage = promptInput?.value?.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;

  promptInput.value = "";
  userData.message = userMessage;
  document.body.classList.add("bot-responding", "chats-active");
  fileUploadWrapper?.classList.remove("active", "img-attached", "file-attached");

  const userMsgHTML = `
    <p class="message-text"></p>
    ${
      userData.file.data
        ? userData.file.isImage
          ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment"/>`
          : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`
        : ""
    }`;
  const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userMessage;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  setTimeout(() => {
    const botMsgHTML = `<img src="" class="avatar" alt="bot"><p class="message-text"><img src="output-onlinegiftools.gif" style="width:50px;"></p>`;
    const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 600);
};

// رفع الملف وتحويله إلى base64
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
      fileInput.value = "";
      const base64String = e.target.result.split(",")[1];
      const preview = fileUploadWrapper?.querySelector(".file-preview");
      if (preview) preview.src = e.target.result;
      fileUploadWrapper?.classList.add("active", isImage ? "img-attached" : "file-attached");

      userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage };
    };
  });
}

// أزرار التحكم
const cancelFileBtn = document.querySelector("#cancel-file-btn");
if (cancelFileBtn) {
  cancelFileBtn.addEventListener("click", () => {
    userData.file = {};
    fileUploadWrapper?.classList.remove("active", "img-attached", "file-attached");
  });
}

const stopResponseBtn = document.querySelector("#stop-response-btn");
if (stopResponseBtn) {
  stopResponseBtn.addEventListener("click", () => {
    userData.file = {};
    controller?.abort();
    if (typingInterval) {
      clearInterval(typingInterval);
      typingInterval = null;
    }
    const loadingBot = chatsContainer.querySelector(".bot-message.loading");
    if (loadingBot) loadingBot.classList.remove("loading");
    document.body.classList.remove("bot-responding");
  });
}

const deleteChatsBtn = document.querySelector("#delete-chats-btn");
if (deleteChatsBtn) {
  deleteChatsBtn.addEventListener("click", () => {
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("bot-responding", "chats-active");
  });
}

document.querySelectorAll(".suggestions-item").forEach((item) => {
  item.addEventListener("click", () => {
    const textEl = item.querySelector(".text");
    if (textEl) {
      promptInput.value = textEl.textContent;
      promptForm.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });
});

document.addEventListener("click", ({ target }) => {
  const wrapper = document.querySelector(".prompt-wrapper");
  if (!wrapper) return;
  const shouldHide =
    target.classList.contains("prompt-input") ||
    (wrapper.classList.contains("hide-controls") && (target.id === "add-file-btn" || target.id === "stop-response-btn"));
  wrapper.classList.toggle("hide-controls", shouldHide);
});

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light-theme");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
    themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
  });

  const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
  document.body.classList.toggle("light-theme", isLightTheme);
  themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
}

if (promptForm) {
  promptForm.addEventListener("submit", handleFormSubmit);
  const addFileBtn = promptForm.querySelector("#add-file-btn");
  if (addFileBtn) addFileBtn.addEventListener("click", () => fileInput?.click());
}

// تهيئة
(function init() {
  promptInput?.focus();
})();
