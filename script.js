INTEGRATE GOOGLE DRIVE HERE TO SAVE FILE ONCE LOGINED-IN 

AND CLEAR ONCE LOG OUT 
WHEN REFREASH LOAD FROM GOOGLE DRIVE FILE
STAY SYNC WITH FILE 

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
const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com";
const API_KEY = "AIzaSyCDg9_fXdnhP31DGwceBdQkWtTIrtTR_OQ";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ";

let tokenClient;
let gapiInited = false;
let gisInited = false;
let accessToken = null;
const FILE_NAME = "trackerData.json"; // the file to store your data

// Load GAPI client
function gapiLoaded() {
  gapi.load("client", initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  });
  gapiInited = true;
}

// Init Google Identity Services
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) throw response;
      accessToken = response.access_token;
      document.getElementById("loginBtn").style.display = "none";
      document.getElementById("logoutBtn").style.display = "block";
      loadDataFromDrive();
    },
  });
  gisInited = true;
}

// Login
document.getElementById("loginBtn").onclick = () => {
  if (!gapiInited || !gisInited) return;
  tokenClient.requestAccessToken({ prompt: "consent" });
};

// Logout
document.getElementById("logoutBtn").onclick = () => {
  accessToken = null;
  document.getElementById("logoutBtn").style.display = "none";
  document.getElementById("loginBtn").style.display = "block";
  deleteAllEntries(); // clear UI
};

// -------- DRIVE FUNCTIONS --------

// Find file in Drive
async function findOrCreateFile() {
  const query = `'${FOLDER_ID}' in parents and name='${FILE_NAME}'`;
  const res = await gapi.client.drive.files.list({ q: query, fields: "files(id,name)" });
  if (res.result.files.length > 0) {
    return res.result.files[0].id;
  } else {
    const file = await gapi.client.drive.files.create({
      resource: { name: FILE_NAME, parents: [FOLDER_ID] },
      fields: "id",
    });
    return file.result.id;
  }
}

// Save all table data to Drive
async function saveDataToDrive() {
  if (!accessToken) return;
  const entries = [];
  document.querySelectorAll("#entriesTableBody tr").forEach((row) => {
    const cols = row.querySelectorAll("td");
    entries.push({
      date: cols[1].textContent,
      title: cols[2].textContent,
      amount: parseFloat(cols[3].textContent.replace("$", "")),
      source: cols[4].textContent,
      status: row.querySelector(".status-dropdown").value,
      notes: cols[6].textContent,
      type: cols[3].classList.contains("green") ? "income" : "expense",
    });
  });

  const fileId = await findOrCreateFile();

  await gapi.client.request({
    path: `/upload/drive/v3/files/${fileId}`,
    method: "PATCH",
    params: { uploadType: "media" },
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
  });

  console.log("✅ Data saved to Drive");
}

// Load data from Drive
async function loadDataFromDrive() {
  const fileId = await findOrCreateFile();
  const res = await gapi.client.drive.files.get({
    fileId: fileId,
    alt: "media",
  });
  const data = res.result;
  deleteAllEntries();
  data.forEach((entry) => {
    addRowToTable(entry.type, entry.title, entry.amount, entry.source, entry.notes, entry.date, entry.id, entry.status);
  });
  console.log("✅ Data loaded from Drive");
}
