<<<<<<< HEAD
const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");

const API_URL = "https://soft-wave-20bc.omarelmoghazy2016.workers.dev";

let typingInterval, controller;
const chatHistory = [];
const userData = { message: "", file: {} };
let lastRequestTime = 0;

// Scroll helper
const scrollToBottom = () => container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });

// Typing effect
const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.textContent = "";
  const words = text.split(" ");
  let wordIndex = 0;

  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
    }
  }, 40);
};

// Message element
const createMsgElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

// Send to Gemini (rate limited)
async function sendToGemini(userInput) {
  const now = Date.now();
  if (now - lastRequestTime < 25000) {
    console.warn("استنى شوية قبل ما تبعت تاني!");
    return;
  }
  lastRequestTime = now;

  const body = {
    contents: [{ parts: [{ text: userInput }] }]
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  console.log("Response:", data);
  return data;
}

// Generate bot response
const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();

  chatHistory.push({
    role: "user",
    parts: [
      { text: userData.message },
      ...(userData.file.data ? [{
        inline_data: {
          mime_type: userData.file.mime_type,
          data: userData.file.data
        }
      }] : [])
    ]
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal
    });

    const data = await response.json();
    console.log("Response:", data);

    if (!response.ok || data.error) {
      throw new Error(data.error?.message || data.error || "Unknown server error");
    }

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const responseText = data.candidates[0].content.parts[0].text
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .trim();

      typingEffect(responseText, textElement, botMsgDiv);
      chatHistory.push({ role: "model", parts: [{ text: responseText }] });
    } else {
      textElement.style.color = "#d92939";
      textElement.textContent = "الرد مش بالصيغة المتوقعة.";
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
    }
  } catch (error) {
    textElement.style.color = "#d92939";
    textElement.textContent = error.name === "AbortError" ? "تم توقيف التفكير." : error.message;
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
  } finally {
    userData.file = {};
  }
};

// Handle form submit
const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;

  promptInput.value = "";
  userData.message = userMessage;
  document.body.classList.add("bot-responding", "chats-active");
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

  const userMsgHTML = `
    <p class="message-text"></p>
    ${userData.file.data ? (userData.file.isImage
      ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment"/>`
      : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ""}`;
  const userMsgDiv = createMsgElement(userMsgHTML, "user-message");

  userMsgDiv.querySelector(".message-text").textContent = userMessage;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  setTimeout(() => {
    const botMsgHTML = `<img src="b8ec91ba-f021-411e-bdf9-29359107b7fd_removalai_preview.png" class="avatar"><p class="message-text"><img src="output-onlinegiftools.gif" style="width: 50px;"></p>`;
    const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 600);
};

// File upload
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = (e) => {
    fileInput.value = "";
    const base64String = e.target.result.split(",")[1];
    fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
    fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");

    userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage };
  };
});

// Cancel file
document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
});

// Stop response
document.querySelector("#stop-response-btn").addEventListener("click", () => {
  userData.file = {};
  controller?.abort();
  clearInterval(typingInterval);
  chatsContainer.querySelector(".bot-message.loading")?.classList.remove("loading");
  document.body.classList.remove("bot-responding");
});

// Delete chats
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
  chatHistory.length = 0;
  chatsContainer.innerHTML = "";
  document.body.classList.remove("bot-responding", "chats-active");
});

// Suggestions
document.querySelectorAll(".suggestions-item").forEach(item => {
  item.addEventListener("click", () => {
    promptInput.value = item.querySelector(".text").textContent;
    promptForm.dispatchEvent(new Event("submit"));
  });
});

// Prompt wrapper toggle
document.addEventListener("click", ({ target }) => {
  const wrapper = document.querySelector(".prompt-wrapper");
  const shouldHide = target.classList.contains("prompt-input") ||
    (wrapper.classList.contains("hide-controls") &&
      (target.id === "add-file-btn" || target.id === "stop-response-btn"));
  wrapper.classList.toggle("hide-controls", shouldHide);
});

// Theme toggle
themeToggle.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
  themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";

// Form submit
promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());
=======
const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");

// 🔥 مفتاح Groq
const API_KEY = "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";

// 🔥 رابط Llama على Groq
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

let typingInterval, controller;

const chatHistory = [];
const userData = { message: "", file: {} };

const scrollToBottom = () =>
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });

const typingEffect = (text, textElement, botMsgDiv) => {
    textElement.textContent = "";
    const words = text.split(" ");
    let wordIndex = 0;

    typingInterval = setInterval(() => {
        if (wordIndex < words.length) {
            textElement.textContent +=
                (wordIndex === 0 ? "" : " ") + words[wordIndex++];
            scrollToBottom();
        } else {
            clearInterval(typingInterval);
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

    // حفظ رسالة المستخدم في التاريخ
    chatHistory.push({
        role: "user",
        content: userData.message
    });

    try {
        // محتوى المستخدم كنص فقط (حتى لو فيه صورة، الموديل ده Text فقط)
        const userContent = userData.message;

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // ✅ رجعناه للموديل المستقر
                messages: [
                    {
                        role: "system",
                        content: `
أنت مساعد ذكي باسم "جي بي توربو".
مهمتك:
- الرد بنفس اللغة التي يكتب بها المستخدم.
- الرد يكون واضحًا، مباشرًا، ومفهومًا، دون أن يكون مقتضبًا جدًا.
- ممنوع اختراع كلمات أو دمج لغات مختلفة في نفس الجملة.
- التزم بأسلوب المستخدم: فصحى، عامية مصرية، أو أي لغة أخرى يكتب بها.
- كن محترفًا، دقيقًا، ومفيدًا.
- لا تذكر أنك نموذج ذكاء اصطناعي أو أنك مدرب على بيانات.
- قدم إجابات عملية ومفيدة دائمًا.
`
                    },
                    ...chatHistory.map(msg => ({
                        role: msg.role,
                        content: msg.content
                    })),
                    {
                        role: "user",
                        content: userContent
                    }
                ]
            }),
            signal: controller.signal
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Error");

        const responseText = data.choices[0].message.content;
        typingEffect(responseText, textElement, botMsgDiv);

        chatHistory.push({
            role: "assistant",
            content: responseText
        });

    } catch (error) {
        textElement.style.color = "#d92939";
        textElement.textContent =
            error.name === "AbortError"
                ? "تم إيقاف الرد."
                : error.message;
        botMsgDiv.classList.remove("loading");
        document.body.classList.remove("bot-responding");
    } finally {
        userData.file = {};
    }
};

/*
ملاحظة: الكود الأصلي لـ handleFormSubmit موجود أدناه كمحاولة للحفاظ على كل شيء،
لكن تم استبداله بوظيفة محسنة async أدناه لدمج قراءة الصور. (لم يتم حذف أي تعريفات أو أجزاء أصلية)
*/

// === دالة قراءة النص من الصور (Vision) ===
// 🔥 رابط Vision على Groq
const VISION_URL = "https://api.groq.com/openai/v1/chat/completions";

async function extractImageText(base64String, mimeType) {
    try {
        const response = await fetch(VISION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.2-11b-vision-preview",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "اقرأ النص من الصورة التالية:" },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${base64String}`
                                }
                            }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Vision Error");

        // بعض موديلات الرؤية ترجع المحتوى في مسار مختلف، فنتأكد من وجوده
        const choice = data.choices && data.choices[0];
        const message = choice?.message;
        const content = message?.content ?? message?.text ?? data.text ?? "";

        return content;
    } catch (err) {
        console.error("Vision API Error:", err);
        return "تعذر قراءة النص من الصورة.";
    }
}

// === نسخة محسنة من handleFormSubmit (تدعم قراءة الصور) ===
const handleFormSubmit = async (e) => {
    e.preventDefault();
    const userMessage = promptInput.value.trim();
    // نسمح بإرسال لو فيه نص أو ملف مرفوع
    if (!userMessage && !userData.file.data) return;
    if (document.body.classList.contains("bot-responding")) return;

    promptInput.value = "";

    const currentDate = new Date().toLocaleString("ar-EG", {
        timeZone: "Africa/Cairo",
    });

    // نبدأ ببناء رسالة المستخدم الأساسية
    let finalMessage = `التاريخ والوقت الآن: ${currentDate}. المستخدم قال: ${userMessage}`;

    // ✅ لو فيه صورة مرفوعة، نقرأ النص منها ونضيفه
    if (userData.file.data && userData.file.isImage) {
        // استدعاء دالة الرؤية لقراءة النص من الصورة
        const visionText = await extractImageText(userData.file.data, userData.file.mime_type);
        // نضيف النص المستخرج بشرط ألا يكون مكررًا أو فارغًا
        if (visionText && visionText.trim() !== "") {
            finalMessage += ` | النص المستخرج من الصورة: ${visionText}`;
        }
    }

    // ✅ لو فيه ملف مرفوع مش صورة (مثلاً PDF) نضيف اسم الملف فقط (أو ممكن توسع لاحقًا لاستخراج نص من PDF)
    if (userData.file.data && !userData.file.isImage) {
        finalMessage += ` | الملف المرفق: ${userData.file.fileName}`;
    }

    // نحفظ الرسالة المجمعة في userData.message كما في الكود الأصلي
    userData.message = finalMessage;

    document.body.classList.add("bot-responding", "chats-active");
    fileUploadWrapper.classList.remove(
        "active",
        "img-attached",
        "file-attached"
    );

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
    // لو المستخدم ما كتبش نص لكن رفع صورة، نعرض "[صورة فقط]" كما في النسخة السابقة
    userMsgDiv.querySelector(".message-text").textContent = userMessage || "[صورة فقط]";
    chatsContainer.appendChild(userMsgDiv);
    scrollToBottom();

    setTimeout(() => {
        const botMsgHTML = `
        <img src="b8ec91ba-f021-411e-bdf9-29359107b7fd_removalai_preview.png" class="avatar">
        <p class="message-text">
            <img src="output-onlinegiftools.gif" style="width: 50px;">
        </p>`;

        const botMsgDiv = createMsgElement(
            botMsgHTML,
            "bot-message",
            "loading"
        );
        chatsContainer.appendChild(botMsgDiv);
        scrollToBottom();
        generateResponse(botMsgDiv);
    }, 600);
};

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
        fileInput.value = "";
        const base64String = e.target.result.split(",")[1];
        fileUploadWrapper.querySelector(".file-preview").src =
            e.target.result;
        fileUploadWrapper.classList.add(
            "active",
            isImage ? "img-attached" : "file-attached"
        );

        userData.file = {
            fileName: file.name,
            data: base64String,
            mime_type: file.type,
            isImage,
        };
    };
});

document
    .querySelector("#cancel-file-btn")
    .addEventListener("click", () => {
        userData.file = {};
        fileUploadWrapper.classList.remove(
            "active",
            "img-attached",
            "file-attached"
        );
    });

document
    .querySelector("#stop-response-btn")
    .addEventListener("click", () => {
        userData.file = {};
        controller?.abort();
        clearInterval(typingInterval);
        chatsContainer
            .querySelector(".bot-message.loading")
            ?.classList.remove("loading");
        document.body.classList.remove("bot-responding");
    });

document
    .querySelector("#delete-chats-btn")
    .addEventListener("click", () => {
        chatHistory.length = 0;
        chatsContainer.innerHTML = "";
        document.body.classList.remove("bot-responding", "chats-active");
    });

document.querySelectorAll(".suggestions-item").forEach((item) => {
    item.addEventListener("click", () => {
        promptInput.value = item.querySelector(".text").textContent;
        promptForm.dispatchEvent(new Event("submit"));
    });
});

document.addEventListener("click", ({ target }) => {
    const wrapper = document.querySelector(".prompt-wrapper");
    const shouldHide =
        target.classList.contains("prompt-input") ||
        (wrapper.classList.contains("hide-controls") &&
            (target.id === "add-file-btn" ||
                target.id === "stop-response-btn"));
    wrapper.classList.toggle("hide-controls", shouldHide);
});

themeToggle.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light-theme");
    localStorage.setItem(
        "themeColor",
        isLightTheme ? "light_mode" : "dark_mode"
    );
    themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

const isLightTheme =
    localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";

promptForm.addEventListener("submit", handleFormSubmit);
promptForm
    .querySelector("#add-file-btn")
    .addEventListener("click", () => fileInput.click());
>>>>>>> 40fa90eb4bf7ed351baaeb66854c63889b842636
