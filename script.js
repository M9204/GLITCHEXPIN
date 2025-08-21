// ================== CONFIG ==================
const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com";
const API_KEY = "AIzaSyCDg9_fXdnhP31DGwceBdQkWtTIrtTR_OQ";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ"; // your folder
const FILE_NAME = "FinanceEntries.json"; // single fixed file
// ============================================

let entries = [];
let currentFileId = null;

// ================== GOOGLE DRIVE AUTH ==================
function handleClientLoad() {
  gapi.load("client:auth2", initClient);
}

function initClient() {
  gapi.client
    .init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      discoveryDocs: [
        "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
      ],
      scope: SCOPES,
    })
    .then(() => {
      const authInstance = gapi.auth2.getAuthInstance();
      authInstance.isSignedIn.listen(updateSigninStatus);
      updateSigninStatus(authInstance.isSignedIn.get());
    });
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    loadOrCreateFile();
  } else {
    gapi.auth2.getAuthInstance().signIn();
  }
}

// ================== DRIVE FILE HANDLING ==================
async function loadOrCreateFile() {
  try {
    // 🔎 search file in folder
    const res = await gapi.client.drive.files.list({
      q: `'${FOLDER_ID}' in parents and name='${FILE_NAME}' and trashed=false`,
      fields: "files(id, name)",
    });

    if (res.result.files && res.result.files.length > 0) {
      currentFileId = res.result.files[0].id;
      console.log("Found file:", currentFileId);
      await loadEntries();
    } else {
      console.log("File not found, creating new one...");
      await createFile();
    }
  } catch (err) {
    console.error("Error loading/creating file:", err);
  }
}

async function createFile() {
  try {
    const fileMetadata = {
      name: FILE_NAME,
      mimeType: "application/json",
      parents: [FOLDER_ID],
    };

    const fileContent = new Blob([JSON.stringify([])], {
      type: "application/json",
    });

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(fileMetadata)], { type: "application/json" })
    );
    form.append("file", fileContent);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: new Headers({
          Authorization: "Bearer " + gapi.auth.getToken().access_token,
        }),
        body: form,
      }
    );

    const file = await res.json();
    currentFileId = file.id;
    entries = [];
    console.log("Created new file:", currentFileId);
  } catch (err) {
    console.error("Error creating file:", err);
  }
}

async function loadEntries() {
  try {
    const res = await gapi.client.drive.files.get({
      fileId: currentFileId,
      alt: "media",
    });

    entries = res.result;
    if (!Array.isArray(entries)) entries = [];
    console.log("Loaded entries:", entries);
    renderEntries();
  } catch (err) {
    console.error("Error loading entries:", err);
  }
}

async function saveEntries() {
  if (!currentFileId) {
    console.error("No file to update!");
    return;
  }

  try {
    const fileContent = new Blob([JSON.stringify(entries)], {
      type: "application/json",
    });

    const form = new FormData();
    form.append(
      "metadata",
      new Blob(
        [JSON.stringify({ name: FILE_NAME, mimeType: "application/json" })],
        { type: "application/json" }
      )
    );
    form.append("file", fileContent);

    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${currentFileId}?uploadType=multipart`,
      {
        method: "PATCH",
        headers: new Headers({
          Authorization: "Bearer " + gapi.auth.getToken().access_token,
        }),
        body: form,
      }
    );

    console.log("✅ Data saved to Google Drive");
  } catch (err) {
    console.error("Error saving entries:", err);
  }
}

// ================== APP LOGIC ==================
function addEntry(entry) {
  entry.id = Date.now();
  entries.push(entry);
  renderEntries();
  saveEntries();
}

function renderEntries() {
  const list = document.getElementById("entriesList");
  if (!list) return;
  list.innerHTML = "";

  entries.forEach((e) => {
    const li = document.createElement("li");
    li.textContent = `${e.type.toUpperCase()} - ${e.title}: ${e.amount}`;
    list.appendChild(li);
  });
}
