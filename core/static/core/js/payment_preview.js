// UI demonstration only: no payment requests or order-status changes.
const paymentDialog = document.querySelector("#payment-dialog");

if (paymentDialog) {
    const paymentForm = document.querySelector("#payment-preview-form");
    const feedback = document.querySelector("#payment-feedback");

    document.querySelector("#open-payment").addEventListener("click", () => {
        paymentForm.reset();
        feedback.textContent = "";
        paymentDialog.showModal();
    });

    document.querySelector("#cancel-payment").addEventListener("click", () => {
        paymentDialog.close();
    });

    paymentForm.addEventListener("input", () => {
        feedback.textContent = "";
    });

    paymentForm.addEventListener("submit", event => {
        event.preventDefault();
        if (!paymentForm.reportValidity()) return;
        const tip = document.querySelector("#payment-tip").valueAsNumber;
        if (!Number.isFinite(tip) || tip < 0) return;
        const method = new FormData(paymentForm).get("payment_method");
        const amount = new Intl.NumberFormat("en-US", {
            style: "currency", currency: "USD",
        }).format(tip);
        feedback.textContent = `Preview: ${method} payment with a ${amount} tip. Nothing was charged or saved; this table remains active.`;
    });
}
