const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const themeToggle = document.querySelector("#theme-toggle-btn");

// DeepSeek API
const API_KEY = "sk-e0545dc18d3c42069a916c1a2c27498c";
const API_URL = "https://api.deepseek.com/chat/completions";

let typingInterval, controller;

const chatHistory = [];

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

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: chatHistory,
            }),
            signal: controller.signal,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Request failed");

        const responseText = data.choices[0].message.content.trim();

        typingEffect(responseText, textElement, botMsgDiv);

        chatHistory.push({ role: "assistant", content: responseText });
    } catch (error) {
        textElement.style.color = "#d92939";
        textElement.textContent =
            error.name === "AbortError" ? "تم توقيف التفكير." : error.message;
        botMsgDiv.classList.remove("loading");
        document.body.classList.remove("bot-responding");
    }
};

const handleFormSubmit = (e) => {
    e.preventDefault();
    const userMessage = promptInput.value.trim();
    if (!userMessage || document.body.classList.contains("bot-responding")) return;

    promptInput.value = "";

    chatHistory.push({ role: "user", content: userMessage });

    document.body.classList.add("bot-responding", "chats-active");

    const userMsgHTML = `<p class="message-text"></p>`;
    const userMsgDiv = createMsgElement(userMsgHTML, "user-message");

    userMsgDiv.querySelector(".message-text").textContent = userMessage;
    chatsContainer.appendChild(userMsgDiv);
    scrollToBottom();

    setTimeout(() => {
        const botMsgHTML = `
            <img src="Images/b8ec91ba-f021-411e-bdf9-29359107b7fd_removalai_preview.png" class="avatar">
            <p class="message-text">
                <img src="Images/output-onlinegiftools.gif" style="width: 50px;">
            </p>`;
        const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
        chatsContainer.appendChild(botMsgDiv);
        scrollToBottom();
        generateResponse(botMsgDiv);
    }, 600);
};

document.querySelector("#stop-response-btn").addEventListener("click", () => {
    controller?.abort();
    clearInterval(typingInterval);
    const loadingMsg = chatsContainer.querySelector(".bot-message.loading");
    if (loadingMsg) loadingMsg.classList.remove("loading");
    document.body.classList.remove("bot-responding");
});

document.querySelector("#delete-chats-btn").addEventListener("click", () => {
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("bot-responding", "chats-active");
});

themeToggle.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light-theme");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
    themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";

promptForm.addEventListener("submit", handleFormSubmit);
