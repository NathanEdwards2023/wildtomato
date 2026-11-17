// Recheck orders when returning to this screen.
window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
});
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") window.location.reload();
});
