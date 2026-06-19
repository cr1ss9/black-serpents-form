const form = document.querySelector("#serpentsForm");
const statusBox = document.querySelector("#status");
const liveTime = document.querySelector("#liveTime");
const otherCheckbox = document.querySelector('input[value="ΑΛΛΟ"]');
const otherField = document.querySelector("#otherField");

function setLiveTime() {
  liveTime.textContent = new Intl.DateTimeFormat("el-GR", {
    dateStyle: "full",
    timeStyle: "medium"
  }).format(new Date());
}

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.dataset.type = type;
}

function toggleOtherField() {
  otherField.classList.toggle("visible", otherCheckbox.checked);
  otherField.querySelector("input").required = otherCheckbox.checked;
}

setLiveTime();
setInterval(setLiveTime, 1000);
toggleOtherField();
otherCheckbox.addEventListener("change", toggleOtherField);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Στέλνεται...");

  const data = new FormData(form);
  const payload = {
    name: data.get("name"),
    patch: data.get("patch"),
    amount: data.get("amount"),
    activities: data.getAll("activities"),
    otherText: data.get("otherText")
  };

  try {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Δεν έγινε αποστολή.");
    }

    form.reset();
    toggleOtherField();
    setStatus(`Η αίτηση στάλθηκε. Ώρα: ${result.submission.createdAtText}`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});
