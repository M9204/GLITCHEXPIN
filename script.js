console.log("script.js is loaded!");

// ====== CONFIG ======
const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com";  // replace
const API_KEY = "AIzaSyCDg9_fXdnhP31DGwceBdQkWtTIrtTR_OQ";  // replace
const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ";
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly";

// The fixed JSON file name
const FILE_NAME = "myData.json";

let tokenClient;
let gapiInited = false;
let gisInited = false;
let fileId = null;   // will store ID of JSON file
let entries = [];    // in-memory data

// ====== INIT ======
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
    callback: "", // defined later
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    document.getElementById("authorize_button").style.display = "block";
  }
}

// ====== AUTH ======
function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) throw resp;
    document.getElementById("authorize_button").style.display = "none";
    document.getElementById("signout_button").style.display = "block";
    await findOrCreateFile();
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
    document.getElementById("authorize_button").style.display = "block";
    document.getElementById("signout_button").style.display = "none";
  }
}

// ====== DRIVE FUNCTIONS ======
async function findOrCreateFile() {
  const res = await gapi.client.drive.files.list({
    q: `'${FOLDER_ID}' in parents and name='${FILE_NAME}' and trashed=false`,
    fields: "files(id, name)",
  });

  if (res.result.files && res.result.files.length > 0) {
    fileId = res.result.files[0].id;
    console.log("Found file:", fileId);
  } else {
    // Create the file if not found
    const metadata = {
      name: FILE_NAME,
      mimeType: "application/json",
      parents: [FOLDER_ID],
    };
    const fileContent = JSON.stringify([]);
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", new Blob([fileContent], { type: "application/json" }));

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: new Headers({ Authorization: "Bearer " + gapi.client.getToken().access_token }),
        body: form,
      }
    );
    const file = await uploadRes.json();
    fileId = file.id;
    console.log("Created file:", fileId);
  }
}

async function loadDataFromDrive() {
  if (!fileId) return;
  const res = await gapi.client.drive.files.get({
    fileId: fileId,
    alt: "media",
  });
  try {
    entries = JSON.parse(res.body) || [];
  } catch {
    entries = [];
  }
  renderEntries();
}

async function saveDataToDrive() {
  if (!fileId) return;
  const content = JSON.stringify(entries, null, 2);

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify({ name: FILE_NAME })], { type: "application/json" })
  );
  form.append("file", new Blob([content], { type: "application/json" }));

  await fetch(
    "https://www.googleapis.com/upload/drive/v3/files/" +
      fileId +
      "?uploadType=multipart",
    {
      method: "PATCH",
      headers: new Headers({ Authorization: "Bearer " + gapi.client.getToken().access_token }),
      body: form,
    }
  );
  console.log("Data saved to Drive:", FILE_NAME);
}

// ====== UI LOGIC ======
function setEntryType(type) {
  const value = document.getElementById("entry_value").value;
  if (!value) return;
  const entry = { type, value, date: new Date().toISOString() };
  entries.push(entry);
  document.getElementById("entry_value").value = "";
  renderEntries();
  saveDataToDrive();
}

function deleteEntry(index) {
  entries.splice(index, 1);
  renderEntries();
  saveDataToDrive();
}

function renderEntries() {
  const list = document.getElementById("entries_list");
  list.innerHTML = "";
  entries.forEach((entry, i) => {
    const li = document.createElement("li");
    li.textContent = `${entry.type}: ${entry.value} (${entry.date}) `;
    const btn = document.createElement("button");
    btn.textContent = "Delete";
    btn.onclick = () => deleteEntry(i);
    li.appendChild(btn);
    list.appendChild(li);
  });
}
