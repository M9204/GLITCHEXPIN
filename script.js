let gapiInited = false;
let gisInited = false;
let tokenClient;
let accessToken = null;
const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com";
const API_KEY = "AIzaSyCDg9_fXdnhP31DGwceBdQkWtTIrtTR_OQ";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ"; // your folder

let entries = []; // local cache

// ---- INIT ----
function gapiLoaded() {
  gapi.load("client", initializeGapiClient);
}
async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  });
  gapiInited = true;
  maybeEnableButtons();
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error !== undefined) throw resp;
      accessToken = resp.access_token;
      loadDataFromDrive();
    },
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    document.getElementById("loginBtn").onclick = () => {
      tokenClient.requestAccessToken({ prompt: "consent" });
      document.getElementById("loginBtn").style.display = "none";
      document.getElementById("logoutBtn").style.display = "inline";
    };
    document.getElementById("logoutBtn").onclick = () => {
      google.accounts.oauth2.revoke(accessToken, () => {
        entries = [];
        renderTable();
        document.getElementById("loginBtn").style.display = "inline";
        document.getElementById("logoutBtn").style.display = "none";
      });
    };
  }
}

// ---- DRIVE HELPERS ----
async function findOrCreateFile() {
  let query = `'${FOLDER_ID}' in parents and name='expenses.json'`;
  let res = await gapi.client.drive.files.list({ q: query, fields: "files(id,name)" });
  if (res.result.files && res.result.files.length > 0) {
    return res.result.files[0].id;
  }
  // create new file
  let fileMetadata = { name: "expenses.json", parents: [FOLDER_ID] };
  let file = new Blob([JSON.stringify([])], { type: "application/json" });
  let form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(fileMetadata)], { type: "application/json" }));
  form.append("file", file);

  let upload = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken },
    body: form,
  });
  let data = await upload.json();
  return data.id;
}

async function saveToDrive() {
  let fileId = await findOrCreateFile();
  let form = new FormData();
  form.append("metadata", new Blob([JSON.stringify({})], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify(entries)], { type: "application/json" }));

  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + accessToken },
    body: form,
  });
}

async function loadDataFromDrive() {
  let fileId = await findOrCreateFile();
  let res = await gapi.client.drive.files.get({
    fileId: fileId,
    alt: "media",
  });
  entries = res.body ? JSON.parse(res.body) : [];
  renderTable();
}

// ---- APP LOGIC ----
function setEntryType(type) {
  let entry = {
    date: document.getElementById("date").value,
    title: document.getElementById("title").value,
    amount: parseFloat(document.getElementById("amount").value),
    source: document.getElementById("source").value,
    status: type,
    notes: document.getElementById("notes").value,
  };
  entries.push(entry);
  saveToDrive();
  renderTable();
  resetForm();
}

function renderTable() {
  let tbody = document.getElementById("entriesTableBody");
  tbody.innerHTML = "";
  let totalIncome = 0, totalExpenses = 0;
  entries.forEach((e) => {
    let row = `<tr>
      <td><input type="checkbox"></td>
      <td>${e.date}</td>
      <td>${e.title}</td>
      <td>${e.amount.toFixed(2)}</td>
      <td>${e.source}</td>
      <td>${e.status}</td>
      <td>${e.notes}</td>
    </tr>`;
    tbody.innerHTML += row;
    if (e.status === "income") totalIncome += e.amount;
    if (e.status === "expense") totalExpenses += e.amount;
  });
  document.getElementById("totalIncome").innerText = "$" + totalIncome.toFixed(2);
  document.getElementById("totalExpenses").innerText = "$" + totalExpenses.toFixed(2);
  document.getElementById("netTotal").innerText = "$" + (totalIncome - totalExpenses).toFixed(2);
}

function resetForm() {
  document.getElementById("title").value = "";
  document.getElementById("date").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("source").value = "";
  document.getElementById("notes").value = "";
}

function exportToExcel() {
  let ws = XLSX.utils.json_to_sheet(entries);
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Entries");
  XLSX.writeFile(wb, "expenses.xlsx");
}
