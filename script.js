// Dark/Light Mode Toggle
const modeToggle = document.getElementById("modeToggle");
modeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  modeToggle.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
});

// Expand Project Cards
document.querySelectorAll(".expand-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const extra = btn.nextElementSibling;
    extra.style.display = extra.style.display === "block" ? "none" : "block";
  });
});

// Copy Email
const copyBtn = document.getElementById("copyEmail");
copyBtn.addEventListener("click", () => {
  const email = document.getElementById("email").innerText;
  navigator.clipboard.writeText(email).then(() => {
    alert("Email copied to clipboard!");
  });
});
