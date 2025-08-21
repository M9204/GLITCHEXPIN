// ===================== CONFIG =====================
const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com"; 
const API_KEY = "AIzaSyCDg9_fXdnhP31DGwceBdQkWtTIrtTR_OQ"; // from Google Cloud Console
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly";
const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ"; // Your folder
const FILE_NAME = "FinanceData.json"; // Single fixed file

// ===================== GLOBALS =====================
let tokenClient;
let gapiInited = false;
let gisInited = false;
let fileId = null;
let entries = [];

// ===================== INIT =====================
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
    callback: "", 
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    document.getElementById("signin_button").style.display = "block";
  }
}

// ===================== AUTH =====================
function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) throw resp;
    document.getElementById("signout_button").style.display = "block";
    document.getElementById("signin_button").style.display = "none";
    await loadDataFromDrive();
  };
  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
    document.getElementById("signin_button").style.display = "block";
    document.getElementById("signout_button").style.display = "none";
  }
}

// ===================== DRIVE OPS =====================
// Find or create the single JSON file
async function getOrCreateFile() {
  if (fileId) return fileId;

  const query = `'${FOLDER_ID}' in parents and name='${FILE_NAME}' and trashed=false`;
  const res = await gapi.client.drive.files.list({
    q: query,
    fields: "files(id, name)",
  });

  if (res.result.files && res.result.files.length > 0) {
    fileId = res.result.files[0].id;
    return fileId;
  }

  // Create if not found
  const fileMetadata = {
    name: FILE_NAME,
    mimeType: "application/json",
    parents: [FOLDER_ID],
  };
  const createRes = await gapi.client.drive.files.create({
    resource: fileMetadata,
    fields: "id",
  });
  fileId = createRes.result.id;

  // Initialize with empty array
  await updateFile([]);
  return fileId;
}

// Load data from Drive
async function loadDataFromDrive() {
  try {
    const id = await getOrCreateFile();
    const res = await gapi.client.drive.files.get({
      fileId: id,
      alt: "media",
    });
    entries = res.body ? JSON.parse(res.body) : [];
    renderEntries();
    console.log("Data loaded from Drive");
  } catch (err) {
    console.error("Error loading file:", err);
  }
}

// Update (overwrite) file in Drive
async function updateFile(data) {
  if (!fileId) await getOrCreateFile();
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const metadata = {
    name: FILE_NAME,
    mimeType: "application/json",
  };

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(data) +
    close_delim;

  await gapi.client.request({
    path: "/upload/drive/v3/files/" + fileId,
    method: "PATCH",
    params: { uploadType: "multipart" },
    headers: {
      "Content-Type": "multipart/related; boundary=" + boundary,
    },
    body: multipartRequestBody,
  });

  console.log("Data synced with Google Drive");
}

// ===================== APP LOGIC =====================
function setEntryType(type) {
  document.getElementById("entryType").value = type;
}

function addEntry() {
  const type = document.getElementById("entryType").value;
  const title = document.getElementById("title").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const source = document.getElementById("source").value;
  const notes = document.getElementById("notes").value;
  const date = document.getElementById("date").value;
  const status = document.getElementById("status").value;

  if (!title || isNaN(amount)) {
    alert("Please enter valid data.");
    return;
  }

  const entry = {
    id: Date.now(),
    type,
    title,
    amount,
    source,
    notes,
    date,
    status,
  };

  entries.push(entry);
  updateFile(entries);
  renderEntries();
  clearForm();
}

function clearForm() {
  document.getElementById("title").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("source").value = "";
  document.getElementById("notes").value = "";
  document.getElementById("date").value = "";
  document.getElementById("status").value = "";
}

function renderEntries() {
  const list = document.getElementById("entriesList");
  list.innerHTML = "";
  entries.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = `${entry.type.toUpperCase()}: ${entry.title} - ${entry.amount} (${entry.date})`;
    list.appendChild(li);
  });
}
