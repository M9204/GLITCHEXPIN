console.log('script.js is loaded!');

let totalIncome = 0;
let totalExpenses = 0;
let currentFileId = null; // Google Drive file ID
const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ";
const FILE_NAME = "ExpenseIncomeData.json";

let entries = [];

// Google API credentials
const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com";
const API_KEY = "AIzaSyCDg9_fXdnhP31DGwceBdQkWtTIrtTR_OQ";
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata";

// ================== WINDOW ONLOAD ==================
window.onload = function () {
  const dateInput = document.getElementById('date');
  const today = new Date();
  dateInput.value = today.toISOString().split('T')[0];
  document.getElementById('inputDate').classList.remove('hidden');

  initGoogleDrive(); // load Google Drive API
  loadData();        // load server data
};

// ================== GOOGLE DRIVE FUNCTIONS ==================
function initGoogleDrive() {
  gapi.load("client:auth2", () => {
    gapi.client.init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
      scope: SCOPES,
    }).then(() => {
      updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
      document.getElementById("loginBtn").onclick = () => gapi.auth2.getAuthInstance().signIn();
      document.getElementById("logoutBtn").onclick = () => gapi.auth2.getAuthInstance().signOut();
      gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
    });
  });
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    document.getElementById("loginBtn").classList.add("hidden");
    document.getElementById("logoutBtn").classList.remove("hidden");
    document.getElementById("userInfo").textContent = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getEmail();
    findOrCreateFile();
  } else {
    document.getElementById("loginBtn").classList.remove("hidden");
    document.getElementById("logoutBtn").classList.add("hidden");
    document.getElementById("userInfo").textContent = "";
  }
}

async function findOrCreateFile() {
  const res = await gapi.client.drive.files.list({
    q: `name='${FILE_NAME}' and '${FOLDER_ID}' in parents and trashed=false`,
    fields: "files(id, name)",
  });

  if (res.result.files.length > 0) {
    currentFileId = res.result.files[0].id;
    console.log("Found file:", currentFileId);
    loadDataFromDrive();
  } else {
    console.log("Creating new file...");
    const metadata = { name: FILE_NAME, mimeType: "application/json", parents: [FOLDER_ID] };
    const file = new Blob([JSON.stringify([])], { type: "application/json" });
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: "Bearer " + gapi.auth.getToken().access_token },
      body: form,
    });
    const result = await uploadRes.json();
    currentFileId = result.id;
    console.log("Created new file:", currentFileId);
  }
}

async function saveDataToDrive() {
  if (!currentFileId) return;
  const fileContent = JSON.stringify(entries);
  const metadata = { name: FILE_NAME };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([fileContent], { type: "application/json" }));

  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${currentFileId}?uploadType=multipart`, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + gapi.auth.getToken().access_token },
    body: form,
  });

  console.log("✅ Data synced with Google Drive");
}

async function loadDataFromDrive() {
  if (!currentFileId) return;
  const res = await gapi.client.drive.files.get({ fileId: currentFileId, alt: "media" });
  entries = res.body ? JSON.parse(res.body) : [];
  console.log("📂 Loaded entries from Drive:", entries);

  document.getElementById("entriesTableBody").innerHTML = "";
  totalIncome = 0; totalExpenses = 0;

  entries.forEach(entry => {
    addRowToTable(entry.type, entry.title, entry.amount, entry.source, entry.notes, entry.date, entry.id, entry.status);
  });
}

// ================== ENTRY MANAGEMENT ==================
function setEntryType(type) {
  const title = document.getElementById('title').value;
  const amount = parseFloat(document.getElementById('amount').value);
  const source = document.getElementById('source').value;
  const notes = document.getElementById('notes').value;
  const date = document.getElementById('date').value;

  if (isNaN(amount) || amount <= 0 || title.trim() === '') {
    alert("Please enter a valid title and amount.");
    return;
  }

  const entryData = {
    id: Date.now(),
    type, title, amount, source, notes, date, status: ""
  };

  entries.push(entryData);
  addRowToTable(type, title, amount, source, notes, date, entryData.id, entryData.status);

  saveDataToDrive();      // save to Google Drive
  saveDataToServer(entryData);  // save to server

  resetForm();
}

function addRowToTable(type, title, amount, source, notes, date, id, status) {
  const tableBody = document.getElementById('entriesTableBody');
  const row = document.createElement('tr');
  row.setAttribute('data-id', id);

  row.innerHTML = `
    <td><input type="checkbox"></td>
    <td>${date}</td>
    <td>${title}</td>
    <td class="${type === 'income' ? 'green' : 'red'}">$${amount.toFixed(2)}</td>
    <td>${source}</td>
    <td>
      <select class="status-dropdown">
        <option value="" ${status === '' ? 'selected' : ''}>-</option>
        <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
        <option value="done" ${status === 'done' ? 'selected' : ''}>Done</option>
      </select>
    </td>
    <td>${notes}</td>
  `;

  const statusDropdown = row.querySelector('.status-dropdown');
  statusDropdown.addEventListener('change', function () {
    const newStatus = statusDropdown.value;
    updateRowBackgroundColor(row, newStatus);

    const entry = entries.find(e => e.id === id);
    if (entry) {
      entry.status = newStatus;
      saveDataToDrive();
      saveStatusToServer(id, newStatus);
    }
  });

  tableBody.appendChild(row);
  updateRowBackgroundColor(row, status);

  // Update totals
  if (type === 'income') { totalIncome += amount; document.getElementById('totalIncome').textContent = `$${totalIncome.toFixed(2)}`; }
  else { totalExpenses += amount; document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`; }

  document.getElementById('netTotal').textContent = `$${(totalIncome - totalExpenses).toFixed(2)}`;
}

function updateRowBackgroundColor(row, status) {
  if (status === 'done') row.style.backgroundColor = 'lightgreen';
  else if (status === 'pending') row.style.backgroundColor = 'lightyellow';
  else row.style.backgroundColor = '';
}

function resetForm() {
  document.getElementById('title').value = '';
  document.getElementById('amount').value = '';
  document.getElementById('source').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('date').value = new Date().toISOString().split('T')[0];
  hideInputs();
}

// ================== INPUT PROGRESSION ==================
function hideInputs() {
  document.getElementById('inputAmount').classList.add('hidden');
  document.getElementById('inputNotes').classList.add('hidden');
  document.getElementById('inputSource').classList.add('hidden');
}

function showInput(id) { document.getElementById(id).classList.remove('hidden'); }

document.getElementById('title').addEventListener('input', function () { if (this.value.trim() !== '') showInput('inputAmount'); });
document.getElementById('amount').addEventListener('input', function () { if (this.value > 0) showInput('inputSource'); });
document.getElementById('source').addEventListener('change', function () { showInput('inputNotes'); });

// ================== SERVER FUNCTIONS ==================
function saveDataToServer(entryData) {
  fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entryData),
  }).then(r => r.json()).then(data => console.log('Data saved to server:', data))
    .catch(e => console.error('Error saving data:', e));
}

function loadData() {
  fetch('/api/data')
    .then(r => r.json())
    .then(data => {
      console.log("Server data loaded:", data);
      data.forEach(entry => {
        addRowToTable(entry.type, entry.title, entry.amount, entry.source, entry.notes, entry.date, entry.id, entry.status);
        entries.push(entry); // ensure local array is updated
      });
    })
    .catch(e => console.error('Error loading data:', e));
}

function saveStatusToServer(id, status) {
  fetch(`/api/updateStatus/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }).then(r => r.json()).then(data => console.log('Status updated on server:', data))
    .catch(e => console.error('Error updating status:', e));
}

// ================== DELETE & EXPORT ==================
function deleteAllEntries() {
  document.getElementById('entriesTableBody').innerHTML = '';
  totalIncome = totalExpenses = 0;
  document.getElementById('totalIncome').textContent = `$0.00`;
  document.getElementById('totalExpenses').textContent = `$0.00`;
  document.getElementById('netTotal').textContent = `$0.00`;
  entries = [];
  saveDataToDrive();
}

function exportToExcel() {
  const tableRows = document.querySelectorAll("#entriesTableBody tr");

  let incomeData = [["Date", "Title", "Amount", "Source", "Notes"]];
  let expenseData = [["Date", "Title", "Amount", "Source", "Notes"]];

  tableRows.forEach(row => {
    const cols = row.querySelectorAll("td");
    const date = cols[1].textContent;
    const title = cols[2].textContent;
    const amount = parseFloat(cols[3].textContent.replace("$", ""));
    const source = cols[4].textContent;
    const notes = cols[6].textContent;

    if (cols[3].classList.contains("green")) incomeData.push([date, title, amount, source, notes]);
    else expenseData.push([date, title, amount, source, notes]);
  });

  let totalData = [["Category", "Amount"], ["Total Income", totalIncome.toFixed(2)], ["Total Expenses", totalExpenses.toFixed(2)], ["Net Total", (totalIncome - totalExpenses).toFixed(2)]];
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incomeData), "Income");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expenseData), "Expenses");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(totalData), "Summary");
  XLSX.writeFile(wb, "income_expense_report.xlsx");
}
