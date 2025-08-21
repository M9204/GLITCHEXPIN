// ===================== CONFIG =====================
const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com"; 
const API_KEY = "AIzaSyCDg9_fXdnhP31DGwceBdQkWtTIrtTR_OQ"; // from Google Cloud Console
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly";
const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ"; // Your folder
const FILE_NAME = "FinanceData.json"; // Single fixed file
console.log('script.js is loaded!');

let totalIncome = 0;
let totalExpenses = 0;
let entries = [];
let tokenClient, gapiInited = false, gisInited = false;
let accessToken = null;


let fileId = null; // ID of our JSON file in Drive

// =================== INIT ===================
window.onload = function () {
  const dateInput = document.getElementById('date');
  const today = new Date();
  dateInput.value = today.toISOString().split('T')[0];
  document.getElementById('inputDate').classList.remove('hidden');

  gapi.load('client', initializeGapiClient);

  document.getElementById('loginBtn').onclick = handleAuthClick;
  document.getElementById('logoutBtn').onclick = handleSignoutClick;
};

// Load GAPI client
async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  });
  gapiInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
      accessToken = tokenResponse.access_token;
      document.getElementById('loginBtn').classList.add('hidden');
      document.getElementById('logoutBtn').classList.remove('hidden');
      loadOrCreateFile();
    },
  });
}

function handleAuthClick() {
  tokenClient.requestAccessToken();
}

function handleSignoutClick() {
  accessToken = null;
  fileId = null;
  entries = [];
  document.getElementById('entriesTableBody').innerHTML = "";
  totalIncome = 0; totalExpenses = 0;
  document.getElementById('totalIncome').textContent = "$0.00";
  document.getElementById('totalExpenses').textContent = "$0.00";
  document.getElementById('netTotal').textContent = "$0.00";

  document.getElementById('loginBtn').classList.remove('hidden');
  document.getElementById('logoutBtn').classList.add('hidden');
}

// =================== DRIVE STORAGE ===================
async function loadOrCreateFile() {
  let response = await gapi.client.drive.files.list({
    q: `'${FOLDER_ID}' in parents and name='${FILE_NAME}' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (response.result.files && response.result.files.length > 0) {
    fileId = response.result.files[0].id;
    console.log("File found:", fileId);
    loadDataFromDrive();
  } else {
    console.log("No file found. Creating new...");
    createDriveFile();
  }
}

async function createDriveFile() {
  const metadata = {
    name: FILE_NAME,
    mimeType: "application/json",
    parents: [FOLDER_ID],
  };
  const fileContent = JSON.stringify([]);
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const body =
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    fileContent +
    closeDelim;

  const response = await gapi.client.request({
    path: "/upload/drive/v3/files",
    method: "POST",
    params: { uploadType: "multipart" },
    headers: { "Content-Type": "multipart/related; boundary=" + boundary },
    body: body,
  });

  fileId = response.result.id;
  console.log("File created:", fileId);
}

// Save full dataset to Drive
async function saveDataToDrive() {
  if (!fileId) return;
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const metadata = { name: FILE_NAME };
  const body =
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(entries) +
    closeDelim;

  await gapi.client.request({
    path: "/upload/drive/v3/files/" + fileId,
    method: "PATCH",
    params: { uploadType: "multipart" },
    headers: { "Content-Type": "multipart/related; boundary=" + boundary },
    body: body,
  });
  console.log("Data synced with Google Drive");
}

// Load dataset from Drive
async function loadDataFromDrive() {
  if (!fileId) return;
  let response = await gapi.client.drive.files.get({
    fileId: fileId,
    alt: "media",
  });

  entries = response.result || [];
  console.log("Loaded from Drive:", entries);

  document.getElementById('entriesTableBody').innerHTML = "";
  totalIncome = 0; totalExpenses = 0;

  entries.forEach(entry => {
    addRowToTable(entry.type, entry.title, entry.amount, entry.source, entry.notes, entry.date, entry.id, entry.status);
  });
}

// =================== APP LOGIC ===================
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

function saveStatusToServer(id, status) {
  const entry = entries.find(e => e.id === id);
  if (entry) {
    entry.status = status;
    saveDataToDrive();
  }
}
