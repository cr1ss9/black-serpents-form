const loginPanel = document.querySelector("#loginPanel");
const submissionsPanel = document.querySelector("#submissionsPanel");
const loginForm = document.querySelector("#loginForm");
const loginStatus = document.querySelector("#loginStatus");
const submissionsList = document.querySelector("#submissionsList");
const refreshButton = document.querySelector("#refreshButton");
const logoutButton = document.querySelector("#logoutButton");

function setLoginStatus(message) {
  loginStatus.textContent = message;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function renderSubmissions(submissions) {
  if (!submissions.length) {
    submissionsList.innerHTML = '<p class="empty-state">Δεν υπάρχουν αιτήσεις ακόμα.</p>';
    return;
  }

  submissionsList.innerHTML = submissions.map((item) => `
    <article class="submission-card">
      <div class="submission-meta">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.createdAtText)}</span>
      </div>
      <dl>
        <div><dt>PATCH</dt><dd>${escapeHtml(item.patch)}</dd></div>
        <div><dt>ΕΦΕΡΑ ΤΟΣΑ</dt><dd>${escapeHtml(item.amount)}</dd></div>
        <div><dt>ΕΚΑΝΑ</dt><dd>${escapeHtml((item.activities || []).join(", "))}</dd></div>
        ${item.otherText ? `<div><dt>ΑΛΛΟ</dt><dd>${escapeHtml(item.otherText)}</dd></div>` : ""}
      </dl>
    </article>
  `).join("");
}

async function loadSubmissions() {
  const response = await fetch("/api/submissions");
  if (response.status === 401) {
    loginPanel.classList.remove("hidden");
    submissionsPanel.classList.add("hidden");
    return;
  }

  const result = await response.json();
  loginPanel.classList.add("hidden");
  submissionsPanel.classList.remove("hidden");
  renderSubmissions(result.submissions || []);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginStatus("Έλεγχος...");
  const password = new FormData(loginForm).get("password");

  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });

  if (!response.ok) {
    setLoginStatus("Λάθος κωδικός.");
    return;
  }

  loginForm.reset();
  setLoginStatus("");
  await loadSubmissions();
});

refreshButton.addEventListener("click", loadSubmissions);

logoutButton.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  loginPanel.classList.remove("hidden");
  submissionsPanel.classList.add("hidden");
});

loadSubmissions();
