console.log('script.js is loaded!');

let totalIncome = 0;
let totalExpenses = 0;
let currentFileId = null; // single file to store data
const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ";
const FILE_NAME = "ExpenseIncomeData.json";
console.log('script.js is loaded!');

let totalIncome = 0;
let totalExpenses = 0;
let entries = []; // all entries
let currentFileId = null; // Google Drive file ID

// Google Drive config
const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ";
const FILE_NAME = "ExpenseIncomeData.json";
const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com";
const API_KEY = "AIzaSyCDg9_fXdnhP31DGwceBdQkWtTIrtTR_OQ";
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata";

window.onload = function () {
  const dateInput = document.getElementById('date');
  const today = new Date();
  dateInput.value = today.toISOString().split('T')[0];
  document.getElementById('inputDate').classList.remove('hidden');

  initGoogleDrive(); // Initialize Google Drive API
};

// ================= GOOGLE DRIVE ================= //
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
    document.getElementById("userInfo").textContent =
      gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getEmail();
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
    const metadata = {
      name: FILE_NAME,
      mimeType: "application/json",
      parents: [FOLDER_ID],
    };
    const file = new Blob([JSON.stringify([])], { type: "application/json" });
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { Authorization: "Bearer " + gapi.auth.getToken().access_token },
        body: form,
      }
    );
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
  console.log("📂 Loaded entries:", entries);

  document.getElementById("entriesTableBody").innerHTML = "";
  totalIncome = 0; totalExpenses = 0;

  entries.forEach(entry => {
    addRowToTable(entry.type, entry.title, entry.amount, entry.source, entry.notes, entry.date, entry.id, entry.status);
  });
}

// ================= APP LOGIC (original functions unchanged) ================= //
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

  const entryData = { id: Date.now(), type, title, amount, source, notes, date, status: "" };

  entries.push(entryData);
  addRowToTable(type, title, amount, source, notes, date, entryData.id, entryData.status);
  saveDataToDrive();
  resetForm();
}

// All your previous functions like addRowToTable, hideInputs, exportToExcel, resetForm, updateRowBackgroundColor remain unchanged

// ================= APP LOGIC (unchanged) ================= //
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
  saveDataToDrive();
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
    }
  });

  tableBody.appendChild(row);
  updateRowBackgroundColor(row, status);

  if (type === 'income') {
    totalIncome += amount;
    document.getElementById('totalIncome').textContent = `$${totalIncome.toFixed(2)}`;
  } else {
    totalExpenses += amount;
    document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
  }

  const netTotal = totalIncome - totalExpenses;
  document.getElementById('netTotal').textContent = `$${netTotal.toFixed(2)}`;
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

// keep all other helpers (hideInputs, exportToExcel, etc.)


console.log('script.js is loaded!');

let totalIncome = 0;
let totalExpenses = 0;

window.onload = function () {
  const dateInput = document.getElementById('date');
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  dateInput.value = formattedDate;
  document.getElementById('inputDate').classList.remove('hidden');

  loadData(); // Load data when the page is loaded
};

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
    type: type,
    title: title,
    amount: amount,
    source: source,
    notes: notes,
    date: date
  };

  // Add the row to the table
  addRowToTable(type, title, amount, source, notes, date);

  // Save data to the server
  saveDataToServer(entryData);

  resetForm();  // Clear the input fields after submitting the entry
}

function addRowToTable(type, title, amount, source, notes, date, id, status) {
  const tableBody = document.getElementById('entriesTableBody');
  const row = document.createElement('tr');
  row.setAttribute('data-id', id); // Store the entry ID in the row for easy lookup

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
    const status = statusDropdown.value;
    updateRowBackgroundColor(row, status);
    saveStatusToServer(id, status);  // Save the updated status to the server
  });

  tableBody.appendChild(row);

  // Update the background color based on the current status
  updateRowBackgroundColor(row, status);

  // Update the totals based on the entry type
  if (type === 'income') {
    totalIncome += amount;
    document.getElementById('totalIncome').textContent = `$${totalIncome.toFixed(2)}`;
  } else {
    totalExpenses += amount;
    document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
  }

  const netTotal = totalIncome - totalExpenses;
  document.getElementById('netTotal').textContent = `$${netTotal.toFixed(2)}`;
}

function updateRowBackgroundColor(row, status) {
  if (status === 'done') {
    row.style.backgroundColor = 'lightgreen';
  } else if (status === 'pending') {
    row.style.backgroundColor = 'lightyellow';
  } else {
    row.style.backgroundColor = ''; // Default background color
  }
}

function hideInputs() {
  document.getElementById('inputAmount').classList.add('hidden');
  document.getElementById('inputNotes').classList.add('hidden');
  document.getElementById('inputSource').classList.add('hidden');
}

function showInput(id) {
  document.getElementById(id).classList.remove('hidden');
}

document.getElementById('title').addEventListener('input', function () {
  if (this.value.trim() !== '') {
    showInput('inputAmount');
  }
});

document.getElementById('amount').addEventListener('input', function () {
  if (this.value > 0) {
    showInput('inputSource');
  }
});

document.getElementById('source').addEventListener('change', function () {
  showInput('inputNotes');
});


function deleteAllEntries() {
  const tableBody = document.getElementById('entriesTableBody');
  tableBody.innerHTML = '';

  totalIncome = 0;
  totalExpenses = 0;
  document.getElementById('totalIncome').textContent = `$${totalIncome.toFixed(2)}`;
  document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
  document.getElementById('netTotal').textContent = `$${(totalIncome - totalExpenses).toFixed(2)}`;
}

function exportToExcel() {
  const tableRows = document.querySelectorAll("#entriesTableBody tr");

  let incomeData = [["Date", "Title", "Amount", "Source", "Notes"]];
  let expenseData = [["Date", "Title", "Amount", "Source", "Notes"]];

  tableRows.forEach(row => {
    const columns = row.querySelectorAll("td");
    const date = columns[1].textContent;
    const title = columns[2].textContent;
    const amount = parseFloat(columns[3].textContent.replace("$", ""));
    const source = columns[4].textContent;
    const notes = columns[6].textContent;

    if (columns[3].classList.contains("green")) {
      incomeData.push([date, title, amount, source, notes]); // Income entry
    } else {
      expenseData.push([date, title, amount, source, notes]); // Expense entry
    }
  });

  // Creating a sheet for totals
  let totalData = [
    ["Category", "Amount"],
    ["Total Income", totalIncome.toFixed(2)],
    ["Total Expenses", totalExpenses.toFixed(2)],
    ["Net Total", (totalIncome - totalExpenses).toFixed(2)]
  ];

  // Create workbook and add sheets
  let wb = XLSX.utils.book_new();
  let wsIncome = XLSX.utils.aoa_to_sheet(incomeData);
  let wsExpense = XLSX.utils.aoa_to_sheet(expenseData);
  let wsTotal = XLSX.utils.aoa_to_sheet(totalData);

  XLSX.utils.book_append_sheet(wb, wsIncome, "Income");
  XLSX.utils.book_append_sheet(wb, wsExpense, "Expenses");
  XLSX.utils.book_append_sheet(wb, wsTotal, "Total Summary");

  // Write the workbook and trigger download
  XLSX.writeFile(wb, "income_expense_report.xlsx");
}


function s2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) {
    view[i] = str.charCodeAt(i) & 0xff;
  }
  return buf;
}

function resetForm() {
  document.getElementById('title').value = '';
  document.getElementById('amount').value = '';
  document.getElementById('source').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('date').value = new Date().toISOString().split('T')[0];
  hideInputs();
}

// Save data to server
function saveDataToServer(entryData) {
  fetch('/api/data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entryData),
  })
  .then(response => response.json())
  .then(data => {
    console.log('Data saved successfully:', data);
  })
  .catch(error => {
    console.error('Error saving data:', error);
  });
}


// Load data from the server and ensure the status is correctly displayed
function loadData() {
  fetch('/api/data')
    .then(response => response.json())
    .then(data => {
      console.log("Data loaded from server:", data);  // Log the data to verify it
      data.forEach(entry => {
        // Add row to table with entry ID and status
        addRowToTable(entry.type, entry.title, entry.amount, entry.source, entry.notes, entry.date, entry.id, entry.status);
      });
    })
    .catch(error => {
      console.error('Error loading data:', error);
    });
}



// Update the status of an entry on the server
function updateStatusOnServer(row, status) {
  const title = row.querySelector('td:nth-child(3)').textContent;
  const date = row.querySelector('td:nth-child(3)').textContent;
  const amount = parseFloat(row.querySelector('td:nth-child(4)').textContent.replace('$', ''));
  const source = row.querySelector('td:nth-child(5)').textContent;
  const notes = row.querySelector('td:nth-child(7)').textContent;

  const updatedData = {
    title: title,
    date: date,
    amount: amount,
    source: source,
    notes: notes,
    status: status
  };

  fetch('/api/updateStatus', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatedData),
  })
  .then(response => response.json())
  .then(data => {
    console.log('Status updated successfully:', data);
  })
  .catch(error => {
    console.error('Error updating status:', error);
  });
}

function saveStatusToServer(id, status) {
  fetch(`/api/updateStatus/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: status }),
  })
  .then(response => response.json())
  .then(data => {
    console.log('Status updated successfully:', data);
  })
  .catch(error => {
    console.error('Error updating status:', error);
  });
}
