console.log("script.js is loaded!");

let totalIncome = 0;
let totalExpenses = 0;
let entries = [];
let accessToken = null;
let fileId = null;
const FILE_NAME = "tracker_data.json";
const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com"; // replace
const SCOPES = "https://www.googleapis.com/auth/drive.file";

// ------------------ AUTH ------------------
function initGoogleAPI() {
  gapi.load("client", async () => {
    await gapi.client.init({
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
    });
  });
}

document.getElementById("loginBtn").addEventListener("click", () => {
  google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      accessToken = resp.access_token;
      document.getElementById("loginBtn").classList.add("hidden");
      document.getElementById("logoutBtn").classList.remove("hidden");
      document.getElementById("userInfo").innerText = "Signed in!";
      loadData();
    },
  }).requestAccessToken();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  accessToken = null;
  entries = [];
  document.getElementById("entriesTableBody").innerHTML = "";
  document.getElementById("loginBtn").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.add("hidden");
  document.getElementById("userInfo").innerText = "";
});

// ------------------ DRIVE HELPERS ------------------
async function getFileId() {
  let res = await gapi.client.drive.files.list({
    q: `name='${FILE_NAME}' and trashed=false`,
    fields: "files(id, name)",
  });
  if (res.result.files.length > 0) return res.result.files[0].id;

  // Create new file
  let createRes = await gapi.client.request({
    path: "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken },
    body: JSON.stringify({ name: FILE_NAME, mimeType: "application/json" }),
  });
  return createRes.result.id;
}

async function saveToDrive() {
  if (!accessToken) return;
  if (!fileId) fileId = await getFileId();

  await gapi.client.request({
    path: `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(entries),
  });
  console.log("Data saved to Drive");
}

async function loadData() {
  if (!accessToken) return;
  fileId = await getFileId();

  let res = await gapi.client.request({
    path: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    method: "GET",
    headers: { Authorization: "Bearer " + accessToken },
  });

  entries = res.body ? JSON.parse(res.body) : [];
  entries.forEach(entry => {
    addRowToTable(entry.type, entry.title, entry.amount, entry.source, entry.notes, entry.date, entry.id, entry.status);
  });
}

// ------------------ APP LOGIC ------------------
window.onload = function () {
  const dateInput = document.getElementById("date");
  const today = new Date();
  dateInput.value = today.toISOString().split("T")[0];
  document.getElementById("inputDate").classList.remove("hidden");
  initGoogleAPI();
  hideInputs();
};

function setEntryType(type) {
  const title = document.getElementById("title").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const source = document.getElementById("source").value;
  const notes = document.getElementById("notes").value;
  const date = document.getElementById("date").value;

  if (isNaN(amount) || amount <= 0 || title.trim() === "") {
    alert("Please enter a valid title and amount.");
    return;
  }

  const entryData = {
    id: Date.now(),
    type,
    title,
    amount,
    source,
    notes,
    date,
    status: "",
  };

  entries.push(entryData);
  addRowToTable(type, title, amount, source, notes, date, entryData.id, entryData.status);
  saveToDrive();
  resetForm();
}

function addRowToTable(type, title, amount, source, notes, date, id, status) {
  const tableBody = document.getElementById("entriesTableBody");
  const row = document.createElement("tr");
  row.setAttribute("data-id", id);

  row.innerHTML = `
    <td><input type="checkbox"></td>
    <td>${date}</td>
    <td>${title}</td>
    <td class="${type === "income" ? "green" : "red"}">$${amount.toFixed(2)}</td>
    <td>${source}</td>
    <td>
      <select class="status-dropdown">
        <option value="" ${status === "" ? "selected" : ""}>-</option>
        <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
        <option value="done" ${status === "done" ? "selected" : ""}>Done</option>
      </select>
    </td>
    <td>${notes}</td>
  `;

  row.querySelector(".status-dropdown").addEventListener("change", function () {
    const newStatus = this.value;
    updateRowBackgroundColor(row, newStatus);
    const entry = entries.find(e => e.id === id);
    if (entry) entry.status = newStatus;
    saveToDrive();
  });

  tableBody.appendChild(row);
  updateRowBackgroundColor(row, status);

  if (type === "income") {
    totalIncome += amount;
    document.getElementById("totalIncome").textContent = `$${totalIncome.toFixed(2)}`;
  } else {
    totalExpenses += amount;
    document.getElementById("totalExpenses").textContent = `$${totalExpenses.toFixed(2)}`;
  }
  document.getElementById("netTotal").textContent = `$${(totalIncome - totalExpenses).toFixed(2)}`;
}

function updateRowBackgroundColor(row, status) {
  if (status === "done") row.style.backgroundColor = "lightgreen";
  else if (status === "pending") row.style.backgroundColor = "lightyellow";
  else row.style.backgroundColor = "";
}

function resetForm() {
  document.getElementById("title").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("source").value = "";
  document.getElementById("notes").value = "";
  document.getElementById("date").value = new Date().toISOString().split("T")[0];
  hideInputs();
}

// ------------------ Progressive Reveal ------------------
function hideInputs() {
  document.getElementById("inputAmount").classList.add("hidden");
  document.getElementById("inputNotes").classList.add("hidden");
  document.getElementById("inputSource").classList.add("hidden");
}
function showInput(id) {
  document.getElementById(id).classList.remove("hidden");
}

document.getElementById("title").addEventListener("input", function () {
  if (this.value.trim() !== "") showInput("inputAmount");
});

document.getElementById("amount").addEventListener("input", function () {
  if (this.value > 0) showInput("inputSource");
});

document.getElementById("source").addEventListener("change", function () {
  showInput("inputNotes");
});
