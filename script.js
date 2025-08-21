// Google Drive Finance Tracker
let entries = [];
let fileId = null; // Store the Google Drive file ID
const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ"; // your folder
const FILE_NAME = "finance-data.json";

// Authorize Google API
function handleClientLoad() {
  gapi.load("client:auth2", initClient);
}

function initClient() {
  gapi.client
    .init({
      apiKey: "YOUR_API_KEY",
      clientId: "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com",
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
      scope: "https://www.googleapis.com/auth/drive.file",
    })
    .then(() => {
      gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
      updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    });
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    loadDataFile(); // Load data when signed in
  } else {
    gapi.auth2.getAuthInstance().signIn();
  }
}

// 🔹 Find or create the finance file in the folder
function loadDataFile() {
  gapi.client.drive.files
    .list({
      q: `'${FOLDER_ID}' in parents and name='${FILE_NAME}' and trashed=false`,
      fields: "files(id, name)",
    })
    .then((res) => {
      if (res.result.files && res.result.files.length > 0) {
        // File exists → use it
        fileId = res.result.files[0].id;
        downloadFile();
      } else {
        // File not found → create it
        createDataFile();
      }
    });
}

function createDataFile() {
  const fileMetadata = {
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
    fileContent +
    closeDelim;

  gapi.client
    .request({
      path: "/upload/drive/v3/files",
      method: "POST",
      params: { uploadType: "multipart" },
      headers: { "Content-Type": "multipart/related; boundary=" + boundary },
      body: body,
    })
    .then((file) => {
      fileId = file.result.id;
      entries = [];
      saveData(); // Save initial empty data
    });
}

function downloadFile() {
  gapi.client.drive.files
    .get({ fileId: fileId, alt: "media" })
    .then((res) => {
      try {
        entries = JSON.parse(res.body) || [];
        renderEntries();
      } catch (e) {
        entries = [];
        renderEntries();
      }
    });
}

// 🔹 Save (update existing file)
function saveData() {
  if (!fileId) return;

  const content = JSON.stringify(entries);
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const body =
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    content +
    closeDelim;

  gapi.client
    .request({
      path: "/upload/drive/v3/files/" + fileId,
      method: "PATCH",
      params: { uploadType: "multipart" },
      headers: { "Content-Type": "multipart/related; boundary=" + boundary },
      body: body,
    })
    .then(() => {
      console.log("✅ Data saved to Google Drive");
    });
}

// =============================
// Your existing entry handling
// =============================
function addEntry(entry) {
  entry.id = Date.now();
  entries.push(entry);
  renderEntries();
  saveData();
}

function renderEntries() {
  const container = document.getElementById("entries");
  container.innerHTML = "";
  entries.forEach((e) => {
    const div = document.createElement("div");
    div.textContent = `${e.type.toUpperCase()}: ${e.title} - ${e.amount}`;
    container.appendChild(div);
  });
}
