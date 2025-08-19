console.log("script.js loaded");

let totalIncome = 0,
  totalExpenses = 0;
let entries = [];
let accessToken = null,
  fileId = null;
const FILE_NAME = "tracker_data.json";
const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com"; // Replace with your client ID
const SCOPES = "https://www.googleapis.com/auth/drive.file";

// Initialize Google API
function initGoogleAPI() {
  gapi.load("client", async () => {
    await gapi.client.init({
      discoveryDocs: [
        "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
      ],
    });
  });
}

// Google Login
document.getElementById("loginBtn").addEventListener("click", () => {
  google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (resp) => {
      accessToken = resp.access_token;
      sessionStorage.setItem("accessToken", accessToken);
      document.getElementById("loginBtn").classList.add("hidden");
      document.getElementById("logoutBtn").classList.remove("hidden");
      document.getElementById("userInfo").innerText = "Signed in!";
      await loadData();
    },
  }).requestAccessToken();
});

// Google Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  accessToken = null;
  fileId = null;
  entries = [];
  sessionStorage.removeItem("accessToken");
  resetTableAndTotals();
  document.getElementById("loginBtn").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.add("hidden");
  document.getElementById("userInfo").innerText = "";
});

// Reset table & totals
function resetTableAndTotals() {
  document.getElementById("entriesTableBody").innerHTML = "";
  totalIncome = 0;
  totalExpenses = 0;
  document.getElementById("totalIncome").textContent = "$0.00";
  document.getElementById("totalExpenses").textContent = "$0.00";
  document.getElementById("netTotal").textContent = "$0.00";
}

// Get or create Drive file
async function getFileId() {
  let res = await gapi.client.drive.files.list({
    q: `name='${FILE_NAME}' and trashed=false`,
    fields: "files(id,name)",
  });

  if (res.result.files.length > 0) {
    fileId = res.result.files[0].id;

    // Rename if still "Untitled"
    if (res.result.files[0].name === "Untitled") {
      await gapi.client.drive.files.update({
        fileId: fileId,
        name: FILE_NAME,
      });
    }
    return fileId;
  }

  // Create file if missing
  let createRes = await gapi.client.request({
    path:
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken },
    body: JSON.stringify({ name: FILE_NAME, mimeType: "application/json" }),
  });

  fileId = createRes.result.id;
  return fileId;
}

// Save entries to Drive
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
  console.log("Data synced with Google Drive");
}

// Load data from Drive
async function loadData() {
  if (!accessToken) return;
  try {
    fileId = await getFileId();
    let res = await gapi.client.request({
      path: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      method: "GET",
      headers: { Authorization: "Bearer " + accessToken },
    });

    if (res.body) {
      try {
        entries = Array.isArray(JSON.parse(res.body))
          ? JSON.parse(res.body)
          : [];
      } catch {
        entries = [];
      }
    } else entries = [];

    resetTableAndTotals();
    entries.forEach((e) =>
      addRowToTable(e.type, e.title, e.amount, e.source, e.notes, e.date, e.id, e.status)
    );
  } catch (err) {
    console.error("Load Drive error:", err);
    entries = [];
  }
}

// Window onload
window.onload = async () => {
  document.getElementById("date").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("inputDate").classList.remove("hidden");
  initGoogleAPI();

  // Use existing token from sessionStorage
  if (sessionStorage.getItem("accessToken")) {
    accessToken = sessionStorage.getItem("accessToken");
    document.getElementById("loginBtn").classList.add("hidden");
    document.getElementById("logoutBtn").classList.remove("hidden");
    document.getElementById("userInfo").innerText = "Signed in!";
    await loadData();
  }

  hideInputs();
};

// Hide/Show Inputs
function hideInputs() {
  ["inputAmount", "inputNotes", "inputSource"].forEach((id) =>
    document.getElementById(id).classList.add("hidden")
  );
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
  if (this.value) showInput("inputNotes");
});

// Add entry
function setEntryType(type) {
  if (!Array.isArray(entries)) entries = [];
  const title = document.getElementById("title").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const source = document.getElementById("source").value;
  const notes = document.getElementById("notes").value;
  const date = document.getElementById("date").value;

  if (!title || isNaN(amount) || amount <= 0)
    return alert("Enter valid title & amount");

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

// Add row to table
function addRowToTable(type, title, amount, source, notes, date, id, status) {
  const tableBody = document.getElementById("entriesTableBody");
  const row = document.createElement("tr");
  row.setAttribute("data-id", id);

  row.innerHTML = `
    <td><input type="checkbox"></td>
    <td>${date}</td>
    <td>${title}</td>
    <td class="${type === "income" ? "green" : "red"}">$${amount.toFixed(
    2
  )}</td>
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

  const statusDropdown = row.querySelector(".status-dropdown");
  statusDropdown.addEventListener("change", async () => {
    const newStatus = statusDropdown.value;
    updateRowBackgroundColor(row, newStatus);
    // Update entries array and Drive
    const entry = entries.find((e) => e.id == id);
    if (entry) {
      entry.status = newStatus;
      await saveToDrive();
    }
  });

  tableBody.appendChild(row);
  updateRowBackgroundColor(row, status);

  // Update totals
  if (type === "income") totalIncome += amount;
  else totalExpenses += amount;

  document.getElementById("totalIncome").textContent = `$${totalIncome.toFixed(2)}`;
  document.getElementById("totalExpenses").textContent = `$${totalExpenses.toFixed(2)}`;
  document.getElementById("netTotal").textContent = `$${(totalIncome - totalExpenses).toFixed(2)}`;
}

// Update row color
function updateRowBackgroundColor(row, status) {
  if (status === "done") row.style.backgroundColor = "lightgreen";
  else if (status === "pending") row.style.backgroundColor = "lightyellow";
  else row.style.backgroundColor = "";
}

// Reset form
function resetForm() {
  document.getElementById("title").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("source").value = "";
  document.getElementById("notes").value = "";
  document.getElementById("date").value = new Date().toISOString().split("T")[0];
  hideInputs();
}

// Export to Excel
function exportToExcel() {
  const tableRows = document.querySelectorAll("#entriesTableBody tr");

  let incomeData = [["Date", "Title", "Amount", "Source", "Notes"]];
  let expenseData = [["Date", "Title", "Amount", "Source", "Notes"]];

  tableRows.forEach((row) => {
    const cols = row.querySelectorAll("td");
    const date = cols[1].textContent;
    const title = cols[2].textContent;
    const amount = parseFloat(cols[3].textContent.replace("$", ""));
    const source = cols[4].textContent;
    const notes = cols[6].textContent;

    if (cols[3].classList.contains("green")) incomeData.push([date, title, amount, source, notes]);
    else expenseData.push([date, title, amount, source, notes]);
  });

  const totalData = [
    ["Category", "Amount"],
    ["Total Income", totalIncome.toFixed(2)],
    ["Total Expenses", totalExpenses.toFixed(2)],
    ["Net Total", (totalIncome - totalExpenses).toFixed(2)],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incomeData), "Income");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expenseData), "Expenses");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(totalData), "Total Summary");
  XLSX.writeFile(wb, "income_expense_report.xlsx");
}
