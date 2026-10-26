const replyForm = document.getElementById("reply-form");
const questionInput = document.getElementById("customer-question");
const charCount = document.getElementById("char-count");
const generateButton = document.getElementById("generate-button");
const buttonLabel = document.getElementById("button-label");
const clearButton = document.getElementById("clear-button");
const replyCard = document.getElementById("reply-card");
const replyText = document.getElementById("reply-text");
const replyStatus = document.getElementById("reply-status");
const replyModel = document.getElementById("reply-model");
const copyButton = document.getElementById("copy-button");
const copyFeedback = document.getElementById("copy-feedback");

let latestReply = "";


async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("The server returned an unreadable response.");
    }

    if (!response.ok) {
        throw new Error(
            data.error || "The request could not be completed."
        );
    }

    return data;
}


function setFormMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("error", isError);
}


function updateCharacterCount() {
    charCount.textContent =
        `${questionInput.value.length} / 1000`;
}


function setReplyStatus(status, message) {
    replyStatus.className = "status-badge";

    if (status === "working") {
        replyStatus.classList.add("status-working");
    }

    if (status === "error") {
        replyStatus.classList.add("status-error");
    }

    replyStatus.textContent = message;
}


function resetReply() {
    latestReply = "";
    replyCard.hidden = true;
    replyText.textContent = "";
    copyFeedback.textContent = "";
    copyButton.disabled = true;
}


questionInput.addEventListener("input", updateCharacterCount);


document.querySelectorAll(".sample-chip").forEach((button) => {
    button.addEventListener("click", () => {
        questionInput.value = button.dataset.example || "";
        updateCharacterCount();
        questionInput.focus();
    });
});


clearButton.addEventListener("click", () => {
    questionInput.value = "";
    updateCharacterCount();
    resetReply();
    questionInput.focus();
});


function buildHistoryCard(item) {
    const card = document.createElement("article");
    card.className = "history-card";

    const meta = document.createElement("div");
    meta.className = "history-meta";

    const model = document.createElement("span");
    model.textContent = item.model || "Gemini";

    const time = document.createElement("time");
    time.textContent = item.created_at || "Just now";

    meta.append(model, time);

    const content = document.createElement("div");
    content.className = "history-content";

    const questionLabel = document.createElement("p");
    questionLabel.className = "history-label";
    questionLabel.textContent = "CUSTOMER QUESTION";

    const question = document.createElement("p");
    question.className = "history-question";
    question.textContent = item.customer_question;

    const replyLabel = document.createElement("p");
    replyLabel.className = "history-label";
    replyLabel.textContent = "GENERATED REPLY";

    const reply = document.createElement("p");
    reply.className = "history-reply";
    reply.textContent = item.ai_reply;

    content.append(
        questionLabel,
        question,
        replyLabel,
        reply
    );

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const reuseButton = document.createElement("button");
    reuseButton.type = "button";
    reuseButton.className = "text-action";
    reuseButton.dataset.historyAction = "reuse";
    reuseButton.textContent = "Reuse question";

    const copyHistoryButton = document.createElement("button");
    copyHistoryButton.type = "button";
    copyHistoryButton.className = "text-action";
    copyHistoryButton.dataset.historyAction = "copy";
    copyHistoryButton.textContent = "Copy reply";

    actions.append(reuseButton, copyHistoryButton);

    card.append(meta, content, actions);

    return card;
}


function addHistoryItem(item) {
    const historyList = document.getElementById("history-list");
    const emptyState = document.getElementById("history-empty");

    if (emptyState) {
        emptyState.remove();
    }

    historyList.prepend(buildHistoryCard(item));

    const cards = historyList.querySelectorAll(".history-card");

    cards.forEach((card, index) => {
        if (index >= 10) {
            card.remove();
        }
    });
}


replyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = questionInput.value.trim();

    if (!question) {
        questionInput.focus();
        return;
    }

    replyCard.hidden = false;

    replyText.textContent =
        "Checking the store information and preparing a reply.";

    setReplyStatus("working", "Generating");

    replyModel.textContent = "Connecting to Gemini";
    copyFeedback.textContent = "";
    copyButton.disabled = true;

    generateButton.disabled = true;
    buttonLabel.textContent = "Generating...";

    try {
        const data = await apiRequest("/api/reply", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                question: question
            })
        });

        latestReply = data.reply;

        replyText.textContent = latestReply;

        setReplyStatus("success", "Draft ready");

        replyModel.textContent =
            `Generated with ${data.model}`;

        copyButton.disabled = false;

        if (data.conversation) {
            addHistoryItem(data.conversation);
        }

    } catch (error) {
        latestReply = "";

        replyText.textContent =
            error.message || "Could not generate a reply.";

        setReplyStatus("error", "Needs attention");

        replyModel.textContent =
            "Check the server terminal for details.";

        console.error("Reply generation failed:", error);

    } finally {
        generateButton.disabled = false;
        buttonLabel.textContent = "Generate reply";
    }
});


copyButton.addEventListener("click", async () => {
    if (!latestReply) {
        return;
    }

    try {
        await navigator.clipboard.writeText(latestReply);
        copyFeedback.textContent = "Copied.";

    } catch (error) {
        copyFeedback.textContent =
            "Copy unavailable. Select the reply manually.";

        console.error("Clipboard error:", error);
    }
});


document.getElementById("history-list").addEventListener(
    "click",
    async (event) => {
        const button = event.target.closest("[data-history-action]");

        if (!button) {
            return;
        }

        const card = button.closest(".history-card");

        if (!card) {
            return;
        }

        const action = button.dataset.historyAction;

        if (action === "reuse") {
            questionInput.value =
                card.querySelector(".history-question").textContent;

            updateCharacterCount();

            questionInput.focus();

            document.getElementById("reply-studio").scrollIntoView({
                behavior: "smooth"
            });

            return;
        }

        if (action === "copy") {
            const reply =
                card.querySelector(".history-reply").textContent;

            try {
                await navigator.clipboard.writeText(reply);
                button.textContent = "Copied";

            } catch (error) {
                window.alert(
                    "Clipboard is unavailable. Please select the reply manually."
                );
            }
        }
    }
);


const productList = document.getElementById("product-list");
const productCount = document.getElementById("product-count");
const addProductButton = document.getElementById("add-product-button");
const productForm = document.getElementById("product-form");

const productFormTitle = document.getElementById("product-form-title");
const productIdInput = document.getElementById("product-id");
const productNameInput = document.getElementById("product-name");
const productPriceInput = document.getElementById("product-price");
const productAvailabilityInput = document.getElementById(
    "product-availability"
);
const productDescriptionInput = document.getElementById(
    "product-description"
);

const productFormMessage = document.getElementById(
    "product-form-message"
);

const saveProductButton = document.getElementById("save-product-button");
const cancelProductButton = document.getElementById(
    "cancel-product-button"
);


function resetProductForm() {
    productForm.reset();
    productIdInput.value = "";
    productFormTitle.textContent = "Add a product";
    saveProductButton.textContent = "Save product";

    setFormMessage(productFormMessage, "");
}


function openProductForm(product = null) {
    resetProductForm();

    if (product) {
        productIdInput.value = product.id;
        productNameInput.value = product.name;
        productPriceInput.value = product.price;
        productAvailabilityInput.value = product.availability;
        productDescriptionInput.value = product.description;

        productFormTitle.textContent = "Edit product";
        saveProductButton.textContent = "Save changes";
    }

    productForm.hidden = false;

    productForm.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

    productNameInput.focus();
}


function closeProductForm() {
    productForm.hidden = true;
    resetProductForm();
}


addProductButton.addEventListener("click", () => {
    openProductForm();
});


cancelProductButton.addEventListener("click", () => {
    closeProductForm();
});


productForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const product = {
        name: productNameInput.value.trim(),
        price: productPriceInput.value.trim(),
        availability: productAvailabilityInput.value,
        description: productDescriptionInput.value.trim()
    };

    const productId = productIdInput.value.trim();
    const isEditing = Boolean(productId);

    const url = isEditing
        ? `/api/products/${encodeURIComponent(productId)}`
        : "/api/products";

    const method = isEditing ? "PATCH" : "POST";

    saveProductButton.disabled = true;
    saveProductButton.textContent = "Saving...";

    setFormMessage(productFormMessage, "Saving product.");

    try {
        await apiRequest(url, {
            method: method,

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(product)
        });

        window.location.reload();

    } catch (error) {
        setFormMessage(
            productFormMessage,
            error.message,
            true
        );

        saveProductButton.disabled = false;
        saveProductButton.textContent = isEditing
            ? "Save changes"
            : "Save product";
    }
});


productList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");

    if (!button) {
        return;
    }

    const row = button.closest("[data-product-id]");

    if (!row) {
        return;
    }

    const productId = row.dataset.productId;

    if (button.dataset.action === "edit") {
        openProductForm({
            id: productId,
            name: row.dataset.name,
            price: row.dataset.price,
            availability: row.dataset.availability,
            description: row.dataset.description
        });

        return;
    }

    if (button.dataset.action === "delete") {
        const confirmed = window.confirm(
            `Delete "${row.dataset.name}"? This cannot be undone.`
        );

        if (!confirmed) {
            return;
        }

        button.disabled = true;
        button.textContent = "Deleting";

        try {
            await apiRequest(
                `/api/products/${encodeURIComponent(productId)}`,
                { method: "DELETE" }
            );

            window.location.reload();

        } catch (error) {
            button.disabled = false;
            button.textContent = "Delete";
            window.alert(error.message);
        }
    }
});


productCount.textContent = `${
    productList.querySelectorAll("[data-product-id]").length
} items`;


const settingsForm = document.getElementById("settings-form");
const settingsMessage = document.getElementById("settings-message");
const saveSettingsButton = document.getElementById(
    "save-settings-button"
);


settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        name: document.getElementById("setting-name").value.trim(),

        category: document.getElementById(
            "setting-category"
        ).value.trim(),

        shipping_karachi: document.getElementById(
            "setting-karachi"
        ).value.trim(),

        shipping_other_cities: document.getElementById(
            "setting-other-cities"
        ).value.trim(),

        standard_fee: document.getElementById(
            "setting-shipping-fee"
        ).value.trim(),

        free_shipping_threshold: document.getElementById(
            "setting-free-shipping"
        ).value.trim(),

        return_policy: document.getElementById(
            "setting-return-policy"
        ).value.trim(),

        payment_methods: document.getElementById(
            "setting-payment-methods"
        ).value,

        support_hours: document.getElementById(
            "setting-support-hours"
        ).value.trim()
    };

    saveSettingsButton.disabled = true;
    saveSettingsButton.textContent = "Saving settings";

    setFormMessage(settingsMessage, "Saving store information.");

    try {
        await apiRequest("/api/settings", {
            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)
        });

        setFormMessage(
            settingsMessage,
            "Settings saved successfully."
        );

        window.location.reload();

    } catch (error) {
        setFormMessage(settingsMessage, error.message, true);

        saveSettingsButton.disabled = false;
        saveSettingsButton.textContent = "Save store settings";
    }
});


const faqList = document.getElementById("faq-list");
const faqForm = document.getElementById("faq-form");
const faqFormTitle = document.getElementById("faq-form-title");
const faqIdInput = document.getElementById("faq-id");
const faqQuestionInput = document.getElementById("faq-question");
const faqAnswerInput = document.getElementById("faq-answer");
const faqFormMessage = document.getElementById("faq-form-message");
const saveFaqButton = document.getElementById("save-faq-button");

const addFaqButton = document.getElementById("add-faq-button");
const cancelFaqButton = document.getElementById("cancel-faq-button");


function resetFaqForm() {
    faqForm.reset();
    faqIdInput.value = "";
    faqFormTitle.textContent = "Add a frequently asked question";
    saveFaqButton.textContent = "Save FAQ";

    setFormMessage(faqFormMessage, "");
}


function openFaqForm(faq = null) {
    resetFaqForm();

    if (faq) {
        faqIdInput.value = faq.id;
        faqQuestionInput.value = faq.question;
        faqAnswerInput.value = faq.answer;

        faqFormTitle.textContent = "Edit frequently asked question";
        saveFaqButton.textContent = "Save changes";
    }

    faqForm.hidden = false;

    faqForm.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

    faqQuestionInput.focus();
}


function closeFaqForm() {
    faqForm.hidden = true;
    resetFaqForm();
}


addFaqButton.addEventListener("click", () => {
    openFaqForm();
});


cancelFaqButton.addEventListener("click", () => {
    closeFaqForm();
});


faqForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const faq = {
        question: faqQuestionInput.value.trim(),
        answer: faqAnswerInput.value.trim()
    };

    const faqId = faqIdInput.value.trim();
    const isEditing = Boolean(faqId);

    const url = isEditing
        ? `/api/faqs/${encodeURIComponent(faqId)}`
        : "/api/faqs";

    const method = isEditing ? "PATCH" : "POST";

    saveFaqButton.disabled = true;
    saveFaqButton.textContent = "Saving";

    setFormMessage(faqFormMessage, "Saving FAQ.");

    try {
        await apiRequest(url, {
            method: method,

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(faq)
        });

        window.location.reload();

    } catch (error) {
        setFormMessage(faqFormMessage, error.message, true);

        saveFaqButton.disabled = false;
        saveFaqButton.textContent = isEditing
            ? "Save changes"
            : "Save FAQ";
    }
});


faqList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");

    if (!button) {
        return;
    }

    const card = button.closest("[data-faq-id]");

    if (!card) {
        return;
    }

    const faqId = card.dataset.faqId;

    if (button.dataset.action === "edit-faq") {
        openFaqForm({
            id: faqId,
            question: card.dataset.question,
            answer: card.dataset.answer
        });

        return;
    }

    if (button.dataset.action === "delete-faq") {
        const confirmed = window.confirm(
            "Delete this FAQ? This cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        button.disabled = true;
        button.textContent = "Deleting";

        try {
            await apiRequest(
                `/api/faqs/${encodeURIComponent(faqId)}`,
                { method: "DELETE" }
            );

            window.location.reload();

        } catch (error) {
            button.disabled = false;
            button.textContent = "Delete";
            window.alert(error.message);
        }
    }
});


updateCharacterCount();
copyButton.disabled = true;